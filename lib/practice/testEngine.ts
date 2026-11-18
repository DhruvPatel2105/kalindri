import "server-only";

/**
 * The practice-TEST engine: sit a whole question set as one session — answer
 * in any order, leave questions blank, submit at the end.
 *
 *   startOrResumeTest   creates the session (or resumes the student's open
 *                       one for the same set), snapshotting every question
 *   saveTestProgress    autosaves one answer / the current position
 *   finishTest          submits: persists an attempt per answered question,
 *                       marks the session complete, then scores
 *   getTestResults      rolls the finished test up for the results page
 *   getReviewQuestion   one question's answer review (submitted vs correct)
 *   startRetry          a new test of just the questions a finished test
 *                       didn't get full marks on; retries chain
 *   getRetryChain       the original test and its retries, with a summary each
 *
 * CLAUDE.md rules baked in:
 *   - #12 never lose an attempt: the attempts are inserted (and the session
 *     marked completed) in one transaction BEFORE any scoring. Scoring is
 *     deterministic and instant, so it runs inline afterwards; if it fails
 *     for a question, that attempt simply has no score yet and
 *     `scoreUnscoredAttempts` retries it (the results page calls it on every
 *     load) — the student never re-answers anything.
 *   - #9 snapshotting: payloads are frozen into sessions.state at start and
 *     grading only reads those.
 *   - #6 every scorer result is stored raw in score_runs.
 *   - Content protection: nothing here lists question payloads for browsing.
 *     A student only receives the questions of the one set they've started,
 *     through their own session (the page strips answer keys before they
 *     reach the browser).
 *
 * Plain server-only functions, NOT "use server": callers authenticate and pass
 * the user. The student-callable mutations live in testActions.ts.
 */

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import {
  attempts,
  questions,
  questionSets,
  scoreRuns,
  scores,
  sessions,
} from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";
import {
  isDeterministicType,
  scoreDeterministic,
} from "@/lib/scoring/registry";

import { pickQuestionIds } from "./questionCount";
import { retryLabel } from "./retry";
import { SCORER_VERSION, scoringRulesFor } from "./scoringRules";
import { validateDeterministicResponse } from "./responseSchemas";
import { buildQuestionReview, type QuestionReview } from "./reviewModel";
import {
  parseStoredSummary,
  questionsToReview,
  summarizeTest,
  type QuestionOutcome,
  type TestSummary,
} from "./testResults";
import {
  buildTestState,
  clampIndex,
  emptyResponseFor,
  extractTestState,
  isAnswered,
  type QuestionSnapshot,
} from "./testState";

type SessionUser = Awaited<ReturnType<typeof requireActiveSession>>;

/** The set doesn't exist, isn't this type, or isn't published/active for this org. */
export class QuestionNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionNotAvailableError";
  }
}

/** The session isn't this user's, doesn't exist, or can't be changed in its current state. */
export class TestSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestSessionError";
  }
}

export interface ActiveTest {
  sessionId: string;
  setTitle: string;
  type: QuestionType;
  /** The question set this test (or the test it retries) came from. */
  setId: string | null;
  /** Set on a retry: the finished test whose mistakes it repeats. */
  retryOfSessionId: string | null;
  startedAt: Date;
  /** Where the student left off (0-based). */
  currentIndex: number;
  /** Full snapshots INCLUDING answer keys — server side only; strip before the browser. */
  snapshots: QuestionSnapshot[];
  /** Draft answers keyed by question id. */
  answers: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*  Start / resume                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Starts the student's test of a set, or resumes the one they left unfinished
 * (an unfinished test keeps the number of questions it started with).
 * `options.count` is how many of the set's questions to sit: that many are
 * picked at random, kept in the set's own order, and frozen into the session;
 * omitted (or more than the set has) means the whole set.
 */
export async function startOrResumeTest(
  user: SessionUser,
  type: QuestionType,
  setId: string,
  options: { count?: number } = {},
): Promise<ActiveTest> {
  const db = getDb();

  const [set] = await db
    .select()
    .from(questionSets)
    .where(
      and(
        eq(questionSets.id, setId),
        eq(questionSets.orgId, user.orgId),
        eq(questionSets.type, type),
        eq(questionSets.status, "published"),
        eq(questionSets.isActive, true),
      ),
    )
    .limit(1);

  if (!set) {
    throw new QuestionNotAvailableError(
      `Question set ${setId} is not an available ${type} set.`,
    );
  }

  // Resume the student's open attempt at this set instead of starting over:
  // reloading, or coming back tomorrow, must never throw answers away.
  const [open] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        eq(sessions.mode, "practice"),
        eq(sessions.questionSetId, set.id),
        eq(sessions.status, "in_progress"),
        // A retry in progress is resumed from its own page, never mistaken
        // for an unfinished attempt at the whole set.
        isNull(sessions.retryOfSessionId),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  if (open) {
    const state = extractTestState(open.state);
    if (state && state.snapshots.length > 0) {
      return {
        sessionId: open.id,
        setTitle: set.title,
        type,
        setId: set.id,
        retryOfSessionId: null,
        startedAt: open.startedAt,
        currentIndex: clampIndex(open.currentItemIndex, state.snapshots.length),
        snapshots: state.snapshots,
        answers: state.answers,
      };
    }
  }

  // Fresh start. Only questions that are still published and active in this
  // org are included; the set's own order is kept.
  const rows = await db
    .select({
      id: questions.id,
      type: questions.type,
      payload: questions.payload,
      version: questions.version,
    })
    .from(questions)
    .where(
      and(
        inArray(questions.id, set.questionIds),
        eq(questions.orgId, user.orgId),
        eq(questions.type, type),
        eq(questions.status, "published"),
        eq(questions.isActive, true),
      ),
    );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const snapshots: QuestionSnapshot[] = [];
  for (const id of set.questionIds) {
    const row = byId.get(id);
    if (row) {
      snapshots.push({ id: row.id, type: row.type, payload: row.payload, version: row.version });
    }
  }

  if (snapshots.length === 0) {
    throw new QuestionNotAvailableError(
      `Question set ${setId} has no published questions.`,
    );
  }

  // A shorter test: a random selection of the set's questions, in set order.
  if (options.count !== undefined) {
    const keep = new Set(
      pickQuestionIds(
        snapshots.map((snapshot) => snapshot.id),
        options.count,
      ),
    );
    const selected = snapshots.filter((snapshot) => keep.has(snapshot.id));
    snapshots.length = 0;
    snapshots.push(...selected);
  }

  // A full practice is the root of its own retry journey, so the id is chosen
  // here to be written into root_session_id in the same insert.
  const sessionId = randomUUID();
  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      orgId: user.orgId,
      userId: user.id,
      mode: "practice",
      questionSetId: set.id,
      sessionType: "FULL_PRACTICE",
      rootSessionId: sessionId,
      questionIds: snapshots.map((s) => s.id),
      currentItemIndex: 0,
      state: buildTestState(snapshots),
      isTimed: false,
    })
    .returning({ id: sessions.id, startedAt: sessions.startedAt });

  if (!session) throw new Error("Failed to start the test.");

  return {
    sessionId: session.id,
    setTitle: set.title,
    type,
    setId: set.id,
    retryOfSessionId: null,
    startedAt: session.startedAt,
    currentIndex: 0,
    snapshots,
    answers: {},
  };
}

/* -------------------------------------------------------------------------- */
/*  Autosave                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveTestProgress(
  user: SessionUser,
  input: {
    sessionId: string;
    currentIndex: number;
    /** Omit to save only the position. */
    answer?: { questionId: string; response: unknown };
  },
): Promise<void> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  if (!session) throw new TestSessionError("Test not found.");
  if (session.status !== "in_progress") {
    throw new TestSessionError("This test has already been submitted.");
  }

  const state = extractTestState(session.state);
  if (!state) throw new TestSessionError("Test is missing its questions.");

  const currentIndex = clampIndex(input.currentIndex, state.snapshots.length);

  if (!input.answer) {
    await db
      .update(sessions)
      .set({ currentItemIndex: currentIndex })
      .where(
        and(eq(sessions.id, session.id), eq(sessions.status, "in_progress")),
      );
    return;
  }

  const { questionId, response } = input.answer;
  const snapshot = state.snapshots.find((s) => s.id === questionId);
  if (!snapshot) throw new TestSessionError("That question isn't in this test.");

  // Reject a malformed response before it is stored. Only deterministic
  // types can be sat in this engine so far.
  if (!isDeterministicType(snapshot.type)) {
    throw new TestSessionError(
      `${snapshot.type} questions can't be answered in a practice test yet.`,
    );
  }
  const validation = validateDeterministicResponse(snapshot.type, response);
  if (!validation.success) {
    throw new TestSessionError(`Invalid response: ${validation.error}`);
  }

  // Write just this one answer key so two quick saves for different
  // questions can't overwrite each other.
  await db
    .update(sessions)
    .set({
      currentItemIndex: currentIndex,
      state: sql`jsonb_set(${sessions.state}, ARRAY['answers', ${questionId}::text], ${JSON.stringify(validation.data)}::jsonb, true)`,
    })
    .where(and(eq(sessions.id, session.id), eq(sessions.status, "in_progress")));
}

/* -------------------------------------------------------------------------- */
/*  Submit                                                                     */
/* -------------------------------------------------------------------------- */

export async function finishTest(
  user: SessionUser,
  sessionId: string,
): Promise<{ sessionId: string }> {
  const db = getDb();

  // Attempts are persisted and the session completed in ONE transaction,
  // before any scoring is attempted (CLAUDE.md #12). The row lock makes a
  // double-click or a second tab submit once, not twice.
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
      .for("update")
      .limit(1);

    if (!session) throw new TestSessionError("Test not found.");
    if (session.status === "completed") return; // already submitted — idempotent
    if (session.status !== "in_progress") {
      throw new TestSessionError("This test can no longer be submitted.");
    }

    const state = extractTestState(session.state);
    if (!state) throw new TestSessionError("Test is missing its questions.");

    const now = new Date();
    // EVERY question in the test gets an attempt row, each carrying the frozen
    // question (type, version, payload with its answer key) so history never
    // depends on the live question. Answered ones are 'submitted'; questions
    // left blank are 'abandoned' with no response, kept out of statistics and
    // not correct.
    if (state.snapshots.length > 0) {
      await tx.insert(attempts).values(
        state.snapshots.map((snapshot) => {
          const response = state.answers[snapshot.id];
          const answered = isAnswered(response);
          return {
            orgId: user.orgId,
            sessionId: session.id,
            userId: user.id,
            questionId: snapshot.id,
            questionSnapshot: snapshot.payload,
            questionType: snapshot.type,
            questionVersion: snapshot.version ?? null,
            scoringRules: scoringRulesFor(snapshot.type),
            response: answered ? response : null,
            status: answered ? ("submitted" as const) : ("abandoned" as const),
            isCorrect: answered ? null : false, // answered ones are set when scored
            // A retry repeats questions whose answers the student has just
            // seen, so it must not count toward question or student stats.
            countsTowardStats: answered && session.retryOfSessionId === null,
            startedAt: session.startedAt,
            submittedAt: now,
          };
        }),
      );
    }

    await tx
      .update(sessions)
      .set({ status: "completed", completedAt: now })
      .where(eq(sessions.id, session.id));
  });

  // Scoring can fail without losing anything: see scoreUnscoredAttempts.
  await scoreUnscoredAttempts(sessionId);

  // Store the result roll-up now (best effort: getTestResults does it again
  // on the next view if this doesn't happen).
  try {
    await getTestResults(user, sessionId);
  } catch {
    // the submission itself is already saved
  }

  return { sessionId };
}

/**
 * Scores every attempt of a session that has no `scores` row yet. Safe to
 * call repeatedly — it only touches unscored attempts — which is what makes
 * a failed scoring job retryable without the student re-answering.
 */
export async function scoreUnscoredAttempts(sessionId: string): Promise<void> {
  const db = getDb();

  const [session] = await db
    .select({ state: sessions.state, orgId: sessions.orgId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const state = session ? extractTestState(session.state) : null;
  if (!session || !state) return;

  const typeById = new Map(state.snapshots.map((s) => [s.id, s.type]));

  const pending = await db
    .select({
      id: attempts.id,
      questionId: attempts.questionId,
      payload: attempts.questionSnapshot,
      response: attempts.response,
    })
    .from(attempts)
    .leftJoin(scores, eq(scores.attemptId, attempts.id))
    .where(
      and(
        eq(attempts.sessionId, sessionId),
        // Blank questions ('abandoned') have nothing to score.
        eq(attempts.status, "submitted"),
        isNull(scores.id),
      ),
    )
    .orderBy(asc(attempts.submittedAt));

  for (const attempt of pending) {
    const type = typeById.get(attempt.questionId);
    if (!type || !isDeterministicType(type)) continue;
    await recordAttemptScore({
      orgId: session.orgId,
      attemptId: attempt.id,
      type,
      payload: attempt.payload,
      response: attempt.response,
    });
  }
}

/**
 * Scores ONE already-saved attempt and records it: a `scores` row, the raw
 * scorer output in `score_runs` (CLAUDE.md #6) and `attempts.is_correct`. If
 * the scorer throws, an error run is recorded instead and nothing is lost —
 * the attempt stays unscored and can be retried. Shared by the test engine
 * and the Practice (learn) engine. Never throws.
 */
export async function recordAttemptScore(input: {
  orgId: string;
  attemptId: string;
  type: QuestionType;
  payload: unknown;
  response: unknown;
}): Promise<void> {
  const db = getDb();
  if (!isDeterministicType(input.type)) return;

  try {
    const result = scoreDeterministic(
      input.type,
      input.payload as never,
      input.response as never,
    );

    await db.insert(scores).values({
      orgId: input.orgId,
      attemptId: input.attemptId,
      trait: "overall",
      score: String(result.score),
      maxScore: String(result.maxScore),
      scorerVersion: SCORER_VERSION,
    });
    await db.insert(scoreRuns).values({
      orgId: input.orgId,
      attemptId: input.attemptId,
      scorerType: "deterministic",
      rawOutput: result,
      status: "success",
    });
    await db
      .update(attempts)
      .set({ isCorrect: result.score >= result.maxScore && result.maxScore > 0 })
      .where(eq(attempts.id, input.attemptId));
  } catch (err) {
    await db.insert(scoreRuns).values({
      orgId: input.orgId,
      attemptId: input.attemptId,
      scorerType: "deterministic",
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Results                                                                    */
/* -------------------------------------------------------------------------- */

export interface TestResultQuestion extends QuestionOutcome {
  index: number;
  id: string;
}

export interface TestResults {
  sessionId: string;
  setId: string | null;
  setTitle: string;
  type: QuestionType;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: Date;
  completedAt: Date | null;
  questions: TestResultQuestion[];
  summary: TestSummary;
}

export async function getTestResults(
  user: SessionUser,
  sessionId: string,
): Promise<TestResults> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  const state = session ? extractTestState(session.state) : null;
  if (!session || !state) throw new TestSessionError("Test not found.");

  // Self-heal: retry any attempt that didn't get scored at submit time.
  if (session.status === "completed") {
    await scoreUnscoredAttempts(session.id);
  }

  const [set] = session.questionSetId
    ? await db
        .select({ title: questionSets.title })
        .from(questionSets)
        .where(eq(questionSets.id, session.questionSetId))
        .limit(1)
    : [];

  const rows = await db
    .select({
      questionId: attempts.questionId,
      status: attempts.status,
      score: scores.score,
      maxScore: scores.maxScore,
    })
    .from(attempts)
    .leftJoin(scores, eq(scores.attemptId, attempts.id))
    .where(eq(attempts.sessionId, session.id));
  const byQuestion = new Map(rows.map((row) => [row.questionId, row]));

  const questionsOut: TestResultQuestion[] = state.snapshots.map(
    (snapshot, index) => {
      const row = byQuestion.get(snapshot.id);
      // Blank questions have an attempt row too ('abandoned'); only submitted ones were answered.
      const answered = row?.status === "submitted";

      let maxScore: number | null = row?.maxScore != null ? Number(row.maxScore) : null;
      if (maxScore === null && isDeterministicType(snapshot.type)) {
        // No score row (unanswered, or scoring failed): the available marks
        // are what the type's empty response is marked out of.
        try {
          maxScore = scoreDeterministic(
            snapshot.type,
            snapshot.payload as never,
            emptyResponseFor(snapshot.type) as never,
          ).maxScore;
        } catch {
          maxScore = null;
        }
      }

      return {
        index,
        id: snapshot.id,
        answered,
        score: row?.score != null ? Number(row.score) : null,
        maxScore,
      };
    },
  );

  const summary = summarizeTest(questionsOut);

  // Keep a stored copy of a finished test's result on the session, once every
  // answer has been marked, so history and later analytics can read it
  // without re-scoring. The attempts and scores stay the source of truth.
  if (
    session.status === "completed" &&
    summary.unscored === 0 &&
    !parseStoredSummary(session.resultSummary)
  ) {
    await db
      .update(sessions)
      .set({ resultSummary: summary })
      .where(eq(sessions.id, session.id));
  }

  return {
    sessionId: session.id,
    setId: session.questionSetId,
    setTitle: set?.title ?? "Practice test",
    type: state.snapshots[0]?.type ?? ("MCS_READING" as QuestionType),
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    questions: questionsOut,
    summary,
  };
}

/* -------------------------------------------------------------------------- */
/*  Answer review                                                              */
/* -------------------------------------------------------------------------- */

/**
 * ONE question's review — what the student answered beside the right answer.
 * This is where an answer key leaves the server, so it is only ever done for
 * a SUBMITTED test (never while it's in progress), only for the student's own
 * session, and one question per call: there is no way to ask for the whole
 * set's answers at once (CLAUDE.md content protection).
 */
export async function getReviewQuestion(
  user: SessionUser,
  sessionId: string,
  index: number,
): Promise<{ index: number; total: number; review: QuestionReview }> {
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  const state = session ? extractTestState(session.state) : null;
  if (!session || !state) throw new TestSessionError("Test not found.");
  if (session.status !== "completed") {
    throw new TestSessionError("Answers are available once the test is submitted.");
  }

  const snapshot = state.snapshots[index];
  if (!snapshot) throw new TestSessionError("That question isn't in this test.");

  // The response that was actually graded: the attempt row. Unanswered
  // questions have none.
  const [attempt] = await db
    .select({ response: attempts.response, questionSnapshot: attempts.questionSnapshot })
    .from(attempts)
    .where(
      and(eq(attempts.sessionId, session.id), eq(attempts.questionId, snapshot.id)),
    )
    .limit(1);

  return {
    index,
    total: state.snapshots.length,
    // The attempt's own frozen copy of the question is the record of what the
    // student saw; the session snapshot is the fallback for tests saved
    // before every question got an attempt row.
    review: buildQuestionReview(
      { ...snapshot, payload: attempt?.questionSnapshot ?? snapshot.payload },
      attempt?.response,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*  Retry: practise the questions you got wrong                                */
/* -------------------------------------------------------------------------- */

const MAX_CHAIN = 50;

type SessionRow = typeof sessions.$inferSelect;

async function findOwnedSession(
  user: SessionUser,
  sessionId: string,
): Promise<SessionRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);
  return row;
}

/**
 * The whole retry journey this session belongs to, oldest (the original test)
 * first. Reads it with one query on root_session_id; sessions saved before
 * that column existed (and not backfilled) fall back to following the parent
 * links.
 */
async function loadChain(user: SessionUser, sessionId: string): Promise<SessionRow[]> {
  const start = await findOwnedSession(user, sessionId);
  if (!start) throw new TestSessionError("Test not found.");

  if (start.rootSessionId) {
    const journey = await getDb()
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.rootSessionId, start.rootSessionId), eq(sessions.userId, user.id)),
      )
      // Each retry starts after its parent finished, so start time is journey order.
      .orderBy(asc(sessions.startedAt), asc(sessions.id))
      .limit(MAX_CHAIN);
    if (journey.some((row) => row.id === start.id)) return journey;
  }

  const chain: SessionRow[] = [start];
  while (chain.length < MAX_CHAIN) {
    const parentId = chain[0]?.retryOfSessionId;
    if (!parentId) break;
    const parent = await findOwnedSession(user, parentId);
    if (!parent) break;
    chain.unshift(parent);
  }
  while (chain.length < MAX_CHAIN) {
    const tail = chain[chain.length - 1];
    if (!tail) break;
    const [child] = await getDb()
      .select()
      .from(sessions)
      .where(and(eq(sessions.retryOfSessionId, tail.id), eq(sessions.userId, user.id)))
      .limit(1);
    if (!child) break;
    chain.push(child);
  }
  return chain;
}

/**
 * Starts a retry of a FINISHED test: a new session holding only the questions
 * that weren't full marks (incorrect, partly correct, unanswered), in their
 * original order. Questions are re-read from the bank so a corrected question
 * is used as corrected; ones that are no longer published are dropped.
 *
 * A finished test has at most one retry. If it already has one in progress,
 * that one is returned (so a double click, or coming back later, resumes it);
 * if it has a finished one, the student should retry from that instead.
 */
export async function startRetry(
  user: SessionUser,
  parentSessionId: string,
): Promise<{ sessionId: string }> {
  const db = getDb();

  // Also scores anything still unscored, so the mistakes list is complete.
  const results = await getTestResults(user, parentSessionId);
  if (results.status !== "completed") {
    throw new TestSessionError("Submit the test before practising its mistakes.");
  }
  if (results.summary.unscored > 0) {
    throw new TestSessionError(
      "Some answers haven't been marked yet. Refresh the results page and try again.",
    );
  }

  const [existing] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.retryOfSessionId, parentSessionId), eq(sessions.userId, user.id)))
    .limit(1);
  if (existing) {
    if (existing.status === "in_progress") return { sessionId: existing.id };
    throw new TestSessionError(
      "You've already practised these questions. Open the latest retry to go again.",
    );
  }

  const mistakeIds = questionsToReview(results.questions).map(
    (item) => results.questions[item.index]?.id ?? "",
  );
  if (mistakeIds.length === 0) {
    throw new TestSessionError("Every question was answered correctly — nothing to retry.");
  }

  const parent = await findOwnedSession(user, parentSessionId);
  if (!parent) throw new TestSessionError("Test not found.");

  const rows = await db
    .select({
      id: questions.id,
      type: questions.type,
      payload: questions.payload,
      version: questions.version,
    })
    .from(questions)
    .where(
      and(
        inArray(questions.id, mistakeIds),
        eq(questions.orgId, user.orgId),
        eq(questions.status, "published"),
        eq(questions.isActive, true),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const snapshots: QuestionSnapshot[] = [];
  for (const id of mistakeIds) {
    const row = byId.get(id);
    if (row) {
      snapshots.push({ id: row.id, type: row.type, payload: row.payload, version: row.version });
    }
  }
  if (snapshots.length === 0) {
    throw new QuestionNotAvailableError("Those questions are no longer available.");
  }

  const [created] = await db
    .insert(sessions)
    .values({
      orgId: user.orgId,
      userId: user.id,
      mode: "practice",
      questionSetId: parent.questionSetId,
      retryOfSessionId: parent.id,
      sessionType: "INCORRECT_PRACTICE",
      // Same journey as the parent: its root, or the parent itself if it is the root.
      rootSessionId: parent.rootSessionId ?? parent.id,
      questionIds: snapshots.map((s) => s.id),
      currentItemIndex: 0,
      state: buildTestState(snapshots),
      isTimed: false,
      // Repeating questions you've just been shown the answers to says little
      // about ability, so it stays out of analytics.
      isScoredForAnalytics: false,
    })
    // The unique index allows one retry per test: a second click that raced
    // this one inserts nothing, and we return the winner below.
    .onConflictDoNothing()
    .returning({ id: sessions.id });

  if (created) return { sessionId: created.id };

  const [winner] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.retryOfSessionId, parent.id))
    .limit(1);
  if (!winner) throw new Error("Failed to start the retry.");
  return { sessionId: winner.id };
}

/** An unfinished retry, loaded by id so it can be resumed or run. */
export async function loadRetrySession(
  user: SessionUser,
  sessionId: string,
): Promise<ActiveTest & { status: SessionRow["status"] }> {
  const session = await findOwnedSession(user, sessionId);
  const state = session ? extractTestState(session.state) : null;
  if (!session || !state || !session.retryOfSessionId) {
    throw new TestSessionError("Test not found.");
  }

  const chain = await loadChain(user, session.id);
  const depth = chain.findIndex((row) => row.id === session.id);

  const [set] = session.questionSetId
    ? await getDb()
        .select({ title: questionSets.title })
        .from(questionSets)
        .where(eq(questionSets.id, session.questionSetId))
        .limit(1)
    : [];

  return {
    sessionId: session.id,
    status: session.status,
    setTitle: `${retryLabel(depth)} — ${set?.title ?? "Practice test"}`,
    type: state.snapshots[0]?.type ?? ("MCS_READING" as QuestionType),
    setId: session.questionSetId,
    retryOfSessionId: session.retryOfSessionId,
    startedAt: session.startedAt,
    currentIndex: clampIndex(session.currentItemIndex, state.snapshots.length),
    snapshots: state.snapshots,
    answers: state.answers,
  };
}

export interface RetryChainEntry {
  sessionId: string;
  /** 0 = the original test. */
  depth: number;
  label: string;
  status: SessionRow["status"];
  questionCount: number;
  startedAt: Date;
  completedAt: Date | null;
  /** null while the round is still in progress. */
  summary: TestSummary | null;
}

/**
 * The original test and every retry of it, oldest first, each with its
 * result summary once finished — what the "Original test → First retry → …"
 * panel on the dashboard shows. Works from any session in the chain.
 */
export async function getRetryChain(
  user: SessionUser,
  sessionId: string,
): Promise<RetryChainEntry[]> {
  const chain = await loadChain(user, sessionId);

  return Promise.all(
    chain.map(async (row, depth): Promise<RetryChainEntry> => {
      const summary =
        row.status === "completed"
          ? (await getTestResults(user, row.id)).summary
          : null;
      return {
        sessionId: row.id,
        depth,
        label: retryLabel(depth),
        status: row.status,
        questionCount: row.questionIds?.length ?? 0,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        summary,
      };
    }),
  );
}
