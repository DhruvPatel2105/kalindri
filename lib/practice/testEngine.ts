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
import { z } from "zod";

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
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";
import {
  isDeterministicType,
  scoreDeterministic,
  type DeterministicScoreResult,
} from "@/lib/scoring/registry";

import { getBankSet, loadRotationInputs } from "./bank";
import { pickQuestionIds } from "./questionCount";
import { selectRotation } from "./rotation";
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

/** Each question's id and type, extracted from sessions.state in SQL by saveTestProgress. */
const snapshotItemsSchema = z.array(
  z.object({ id: z.string().min(1), type: z.enum(QUESTION_TYPES) }),
);

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
 *
 * Round trips: the set, any open session and the set's questions are
 * independent, so they are read together in ONE batch (the question ids are
 * looked up inside the questions query rather than waiting for the set row).
 * Resuming is therefore one trip; a fresh start is that plus the insert.
 */
export async function startOrResumeTest(
  user: SessionUser,
  type: QuestionType,
  setId: string,
  options: { count?: number } = {},
): Promise<ActiveTest> {
  const db = getDb();

  const visibleSet = and(
    eq(questionSets.id, setId),
    eq(questionSets.orgId, user.orgId),
    eq(questionSets.type, type),
    eq(questionSets.status, "published"),
    eq(questionSets.isActive, true),
  );
  const setQuestionIds = sql`(select unnest(${questionSets.questionIds}) from ${questionSets} where ${visibleSet})`;

  // The student's open attempt at this set: resumed instead of starting over,
  // so reloading, or coming back tomorrow, never throws answers away. A retry
  // in progress is resumed from its own page, never mistaken for this.
  const findOpenRow = () =>
    db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          eq(sessions.mode, "practice"),
          eq(sessions.questionSetId, setId),
          eq(sessions.status, "in_progress"),
          isNull(sessions.retryOfSessionId),
        ),
      )
      .orderBy(desc(sessions.startedAt))
      .limit(1);

  const [[set], [open], rows] = await Promise.all([
    db
      .select({
        id: questionSets.id,
        title: questionSets.title,
        questionIds: questionSets.questionIds,
        isBank: questionSets.isBank,
      })
      .from(questionSets)
      .where(visibleSet)
      .limit(1),
    findOpenRow(),
    // Only questions still published and active in this org are included.
    db
      .select({
        id: questions.id,
        type: questions.type,
        payload: questions.payload,
        version: questions.version,
      })
      .from(questions)
      .where(
        and(
          sql`${questions.id} in ${setQuestionIds}`,
          eq(questions.orgId, user.orgId),
          eq(questions.type, type),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
        ),
      ),
  ]);

  if (!set) {
    throw new QuestionNotAvailableError(
      `Question set ${setId} is not an available ${type} set.`,
    );
  }

  const asActive = (row: typeof open): ActiveTest | null => {
    const state = row ? extractTestState(row.state) : null;
    if (!row || !state || state.snapshots.length === 0) return null;
    return {
      sessionId: row.id,
      setTitle: set.title,
      type,
      setId: set.id,
      retryOfSessionId: null,
      startedAt: row.startedAt,
      currentIndex: clampIndex(row.currentItemIndex, state.snapshots.length),
      snapshots: state.snapshots,
      answers: state.answers,
    };
  };

  const resumed = asActive(open);
  if (resumed) return resumed;

  // Fresh start. A MIXED test (the type's bank set) draws its questions with
  // rotation — never a question the student has answered this round — from
  // the whole bank; an ordinary set keeps its own questions and order.
  let source = rows;
  let order: readonly string[] = set.questionIds;
  if (set.isBank) {
    const inputs = await loadRotationInputs(db, { userId: user.id, orgId: user.orgId, type });
    const chosen = selectRotation({
      pool: inputs.pool,
      history: inputs.history,
      reserved: inputs.reserved,
      count: options.count ?? inputs.pool.length,
    });
    if (chosen.length === 0) {
      throw new QuestionNotAvailableError(
        "No questions are available for a mixed test right now (all are in your open tests).",
      );
    }
    source = await db
      .select({
        id: questions.id,
        type: questions.type,
        payload: questions.payload,
        version: questions.version,
      })
      .from(questions)
      .where(
        and(
          inArray(questions.id, chosen),
          eq(questions.orgId, user.orgId),
          eq(questions.type, type),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
        ),
      );
    order = chosen;
    // Keep the set's id list equal to the bank (also creates nothing new here).
    await getBankSet(db, { orgId: user.orgId, type, pool: inputs.pool });
  }

  const byId = new Map(source.map((row) => [row.id, row]));
  const snapshots: QuestionSnapshot[] = [];
  for (const id of order) {
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
  // (A mixed test has already been sized by the rotation above.)
  if (options.count !== undefined && !set.isBank) {
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
    // One open test per student per set (unique index): if a second click or
    // tab got there first, nothing is inserted and that test is resumed.
    .onConflictDoNothing()
    .returning({ id: sessions.id, startedAt: sessions.startedAt });

  if (!session) {
    const [winner] = await findOpenRow();
    const resumedWinner = asActive(winner);
    if (resumedWinner) return resumedWinner;
    throw new Error("Failed to start the test.");
  }

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

/**
 * Autosave: one statement, one round trip (the caller's login check is the
 * only other trip). The update is written so it can only succeed when
 * everything the careful path checks holds: the session is this student's and
 * still in progress, the question is in it, and the response has the right
 * SHAPE for that question's type (a string for single choice, an array of
 * strings for the other practisable types). Anything else — a missing or
 * submitted test, a question not in it, a malformed answer, a type this fast
 * gate doesn't cover — matches no row, and the full checked path runs to
 * return the exact error (or store the answer, for other types).
 */
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
  const index = Number.isInteger(input.currentIndex) ? input.currentIndex : 0;
  // The position, held to 0..(number of questions - 1) inside the statement.
  const clamped = sql`LEAST(GREATEST(${index}::int, 0), GREATEST(jsonb_array_length(${sessions.state}->'snapshots') - 1, 0))`;
  const mine = and(
    eq(sessions.id, input.sessionId),
    eq(sessions.userId, user.id),
    eq(sessions.status, "in_progress"),
  );

  if (!input.answer) {
    const done = await db
      .update(sessions)
      .set({ currentItemIndex: clamped })
      .where(mine)
      .returning({ id: sessions.id });
    if (done.length > 0) return;
    return saveTestProgressChecked(user, input); // explains why not
  }

  const { questionId, response } = input.answer;
  const json = JSON.stringify(response ?? null);
  const shapeOk = sql`CASE s->>'type'
      WHEN 'MCS_READING' THEN jsonb_typeof(${json}::jsonb) = 'string'
      WHEN 'MCM_READING' THEN ${arrayOfStrings(json)}
      WHEN 'REORDER_PARAGRAPH' THEN ${arrayOfStrings(json)}
      WHEN 'FIB_READING' THEN ${arrayOfStrings(json)}
      WHEN 'FIB_RW' THEN ${arrayOfStrings(json)}
      ELSE false END`;
  const done = await db
    .update(sessions)
    .set({
      currentItemIndex: clamped,
      state: sql`jsonb_set(${sessions.state}, ARRAY['answers', ${questionId}::text], ${json}::jsonb, true)`,
    })
    .where(
      and(
        mine,
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${sessions.state}->'snapshots') AS s
                     WHERE s->>'id' = ${questionId} AND ${shapeOk})`,
      ),
    )
    .returning({ id: sessions.id });
  if (done.length > 0) return;
  return saveTestProgressChecked(user, input);
}

/** SQL: `json` is an array whose elements are all strings. */
function arrayOfStrings(json: string) {
  return sql`(jsonb_typeof(${json}::jsonb) = 'array' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(${json}::jsonb) AS e WHERE jsonb_typeof(e) <> 'string'))`;
}

async function saveTestProgressChecked(
  user: SessionUser,
  input: {
    sessionId: string;
    currentIndex: number;
    /** Omit to save only the position. */
    answer?: { questionId: string; response: unknown };
  },
): Promise<void> {
  const db = getDb();

  // Only what autosave needs: the status and each question's id and type —
  // not the frozen passages and answer keys, which are most of the session
  // row and would otherwise be read on every save.
  const [session] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      items: sql<unknown>`(
        SELECT jsonb_agg(jsonb_build_object('id', s->>'id', 'type', s->>'type'))
        FROM jsonb_array_elements(${sessions.state}->'snapshots') AS s
      )`,
    })
    .from(sessions)
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  if (!session) throw new TestSessionError("Test not found.");
  if (session.status !== "in_progress") {
    throw new TestSessionError("This test has already been submitted.");
  }

  const items = snapshotItemsSchema.safeParse(session.items);
  if (!items.success || items.data.length === 0) {
    throw new TestSessionError("Test is missing its questions.");
  }

  const currentIndex = clampIndex(input.currentIndex, items.data.length);

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
  const snapshot = items.data.find((s) => s.id === questionId);
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

  // Trip 1: the session (the only read submitting needs).
  const [session] = await db
    .select({
      id: sessions.id,
      orgId: sessions.orgId,
      status: sessions.status,
      state: sessions.state,
      startedAt: sessions.startedAt,
      retryOfSessionId: sessions.retryOfSessionId,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  if (!session) throw new TestSessionError("Test not found.");
  if (session.status === "completed") return { sessionId }; // already submitted — idempotent
  if (session.status !== "in_progress") {
    throw new TestSessionError("This test can no longer be submitted.");
  }
  const state = extractTestState(session.state);
  if (!state) throw new TestSessionError("Test is missing its questions.");

  // Marking is deterministic and instant, so it is done here in memory, from
  // the frozen snapshots and the saved answers — no second read of anything.
  const now = new Date();
  const rows = state.snapshots.map((snapshot) => {
    const response = state.answers[snapshot.id];
    const answered = isAnswered(response);
    let result: DeterministicScoreResult | null = null;
    let failure: string | null = null;
    if (answered && isDeterministicType(snapshot.type)) {
      try {
        result = scoreDeterministic(snapshot.type, snapshot.payload as never, response as never);
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }
    }
    // What the question is marked out of when it has no score (left blank, or
    // marking failed): the maximum for the type's empty response.
    let maxScore: number | null = result?.maxScore ?? null;
    if (maxScore === null && isDeterministicType(snapshot.type)) {
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
    return { snapshot, response, answered, result, failure, maxScore, attemptId: randomUUID() };
  });

  const summary = summarizeTest(
    rows.map((row) => ({
      answered: row.answered,
      score: row.result ? row.result.score : null,
      maxScore: row.maxScore,
    })),
  );

  // EVERY question gets an attempt row carrying the frozen question (type,
  // version, payload with its answer key), so history never depends on the
  // live question. Answered ones are 'submitted'; blank ones are 'abandoned'
  // with no response, outside statistics and not correct. A retry repeats
  // questions whose answers the student has just seen, so it never counts
  // toward question or student stats.
  const attemptRows = rows.map((row) => ({
    id: row.attemptId,
    question_id: row.snapshot.id,
    question_snapshot: row.snapshot.payload,
    question_type: row.snapshot.type,
    question_version: row.snapshot.version ?? null,
    scoring_rules: scoringRulesFor(row.snapshot.type),
    response: row.answered ? row.response : null,
    status: row.answered ? "submitted" : "abandoned",
    is_correct: row.answered ? (row.result ? row.result.score >= row.result.maxScore && row.result.maxScore > 0 : null) : false,
    counts_toward_stats: row.answered && session.retryOfSessionId === null,
  }));
  const scoreRows = rows.flatMap((row) =>
    row.result
      ? [{ attempt_id: row.attemptId, score: String(row.result.score), max_score: String(row.result.maxScore), raw: row.result }]
      : [],
  );
  const errorRows = rows.flatMap((row) =>
    row.failure ? [{ attempt_id: row.attemptId, message: row.failure }] : [],
  );

  // Trip 2: ONE statement does everything, atomically. The first step marks
  // the session completed ONLY if it is still in progress; every later step
  // reads from that step's result, so a second tab or double click that loses
  // the race inserts nothing (and the winner's rows are untouched). The
  // result summary is stored only once every answer has a mark, as before.
  const summaryJson = summary.unscored === 0 ? JSON.stringify(summary) : null;
  await db.execute(sql`
    WITH done AS (
      UPDATE sessions
         SET status = 'completed', completed_at = ${now.toISOString()}::timestamptz,
             result_summary = ${summaryJson}::jsonb
       WHERE id = ${session.id} AND user_id = ${user.id} AND status = 'in_progress'
   RETURNING id
    ),
    ins AS (
      INSERT INTO attempts (id, org_id, session_id, user_id, question_id, question_snapshot,
                            question_type, question_version, scoring_rules, response, status,
                            is_correct, counts_toward_stats, started_at, submitted_at)
      SELECT a.id, ${session.orgId}::uuid, done.id, ${user.id}::uuid, a.question_id, a.question_snapshot,
             a.question_type, a.question_version, NULLIF(a.scoring_rules, 'null'::jsonb),
             NULLIF(a.response, 'null'::jsonb), a.status, a.is_correct, a.counts_toward_stats,
             ${session.startedAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz
        FROM done, jsonb_to_recordset(${JSON.stringify(attemptRows)}::jsonb) AS a(
               id uuid, question_id uuid, question_snapshot jsonb, question_type question_type,
               question_version int, scoring_rules jsonb, response jsonb, status attempt_status,
               is_correct boolean, counts_toward_stats boolean)
   RETURNING id
    ),
    sc AS (
      INSERT INTO scores (org_id, attempt_id, trait, score, max_score, scorer_version)
      SELECT ${session.orgId}::uuid, s.attempt_id, 'overall', s.score::numeric, s.max_score::numeric, ${SCORER_VERSION}
        FROM done, jsonb_to_recordset(${JSON.stringify(scoreRows)}::jsonb) AS s(
               attempt_id uuid, score text, max_score text)
      ON CONFLICT DO NOTHING
   RETURNING attempt_id
    ),
    runs AS (
      INSERT INTO score_runs (org_id, attempt_id, scorer_type, raw_output, status)
      SELECT ${session.orgId}::uuid, s.attempt_id, 'deterministic', s.raw, 'success'
        FROM done, jsonb_to_recordset(${JSON.stringify(scoreRows)}::jsonb) AS s(attempt_id uuid, raw jsonb)
   RETURNING id
    )
    INSERT INTO score_runs (org_id, attempt_id, scorer_type, status, error_message)
    SELECT ${session.orgId}::uuid, e.attempt_id, 'deterministic', 'error', e.message
      FROM done, jsonb_to_recordset(${JSON.stringify(errorRows)}::jsonb) AS e(attempt_id uuid, message text)
  `);

  return { sessionId };
}

/**
 * Scores every attempt of a session that has no `scores` row yet. Safe to
 * call repeatedly — it only touches unscored attempts — which is what makes
 * a failed scoring job retryable without the student re-answering.
 */
export async function scoreUnscoredAttempts(sessionId: string): Promise<void> {
  const db = getDb();

  const pending = await db
    .select({
      id: attempts.id,
      orgId: attempts.orgId,
      questionId: attempts.questionId,
      type: attempts.questionType,
      payload: attempts.questionSnapshot,
      response: attempts.response,
    })
    .from(attempts)
    .leftJoin(scores, and(eq(scores.attemptId, attempts.id), eq(scores.trait, "overall")))
    .where(
      and(
        eq(attempts.sessionId, sessionId),
        // Blank questions ('abandoned') have nothing to score.
        eq(attempts.status, "submitted"),
        isNull(scores.id),
      ),
    );
  if (pending.length === 0) return;

  // Attempts saved before attempts.question_type existed: take the type from
  // the session's frozen snapshots instead (only read when needed).
  let legacyTypes: Map<string, QuestionType> | null = null;
  if (pending.some((attempt) => !attempt.type)) {
    const [session] = await db
      .select({ state: sessions.state })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    const state = session ? extractTestState(session.state) : null;
    legacyTypes = new Map((state?.snapshots ?? []).map((s) => [s.id, s.type]));
  }

  await recordAttemptScores(
    pending.flatMap((attempt) => {
      const type = attempt.type ?? legacyTypes?.get(attempt.questionId);
      return type
        ? [{ orgId: attempt.orgId, attemptId: attempt.id, type, payload: attempt.payload, response: attempt.response }]
        : [];
    }),
  );
}

interface ScoreJob {
  orgId: string;
  attemptId: string;
  type: QuestionType;
  payload: unknown;
  response: unknown;
}

/**
 * Scores already-saved attempts and records the results: a `scores` row
 * each, the raw scorer output in `score_runs` (CLAUDE.md #6) and
 * `attempts.is_correct`. Marking happens in memory; the writes are three
 * statements in one transaction however many attempts there are (not three
 * per attempt). A scorer that throws records an error run for that attempt
 * and leaves it unscored to be retried. Never throws — if the writes fail,
 * nothing is half-written and the next view retries.
 */
export async function recordAttemptScores(jobs: readonly ScoreJob[]): Promise<void> {
  const marked: { job: ScoreJob; result: DeterministicScoreResult }[] = [];
  const failed: { job: ScoreJob; message: string }[] = [];
  for (const job of jobs) {
    if (!isDeterministicType(job.type)) continue;
    try {
      marked.push({
        job,
        result: scoreDeterministic(job.type, job.payload as never, job.response as never),
      });
    } catch (err) {
      failed.push({ job, message: err instanceof Error ? err.message : String(err) });
    }
  }
  if (marked.length === 0 && failed.length === 0) return;

  try {
    await getDb().transaction(async (tx) => {
      if (marked.length > 0) {
        await tx
          .insert(scores)
          .values(
            marked.map(({ job, result }) => ({
              orgId: job.orgId,
              attemptId: job.attemptId,
              trait: "overall",
              score: String(result.score),
              maxScore: String(result.maxScore),
              scorerVersion: SCORER_VERSION,
            })),
          )
          // Two views scoring the same attempt at once: the second is a no-op.
          .onConflictDoNothing();

        await tx
          .update(attempts)
          .set({
            isCorrect: sql`CASE ${attempts.id} ${sql.join(
              marked.map(
                ({ job, result }) =>
                  sql`WHEN ${job.attemptId}::uuid THEN ${result.score >= result.maxScore && result.maxScore > 0}::boolean`,
              ),
              sql` `,
            )} END`,
          })
          .where(inArray(attempts.id, marked.map(({ job }) => job.attemptId)));
      }

      await tx.insert(scoreRuns).values([
        ...marked.map(({ job, result }) => ({
          orgId: job.orgId,
          attemptId: job.attemptId,
          scorerType: "deterministic" as const,
          rawOutput: result,
          status: "success" as const,
        })),
        ...failed.map(({ job, message }) => ({
          orgId: job.orgId,
          attemptId: job.attemptId,
          scorerType: "deterministic" as const,
          status: "error" as const,
          errorMessage: message,
        })),
      ]);
    });
  } catch {
    // Nothing was written; the attempts stay unscored and the next view retries.
  }
}

/** Scores ONE already-saved attempt (Practice mode's Answer). See recordAttemptScores. */
export async function recordAttemptScore(job: ScoreJob): Promise<void> {
  await recordAttemptScores([job]);
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

  // ONE batch: the session (with its set's title, joined) and its attempts'
  // marks don't depend on each other — both are keyed by the id in the URL and
  // restricted to this student — so they are read together.
  const fetchMarks = () =>
    db
      .select({
        questionId: attempts.questionId,
        status: attempts.status,
        score: scores.score,
        maxScore: scores.maxScore,
      })
      .from(attempts)
      .leftJoin(scores, and(eq(scores.attemptId, attempts.id), eq(scores.trait, "overall")))
      .where(and(eq(attempts.sessionId, sessionId), eq(attempts.userId, user.id)));

  const [[found], firstMarks] = await Promise.all([
    db
      .select({ session: sessions, title: questionSets.title })
      .from(sessions)
      .leftJoin(questionSets, eq(sessions.questionSetId, questionSets.id))
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
      .limit(1),
    fetchMarks(),
  ]);

  const session = found?.session;
  const state = session ? extractTestState(session.state) : null;
  if (!session || !state) throw new TestSessionError("Test not found.");
  const set = found ? { title: found.title } : undefined;

  // Self-heal: an answered question with no mark (marking failed at submit)
  // is marked now and the marks re-read. Only when there is something to
  // mark — the usual view needs no extra trip.
  let rows = firstMarks;
  if (
    session.status === "completed" &&
    firstMarks.some((row) => row.status === "submitted" && row.score === null)
  ) {
    await scoreUnscoredAttempts(session.id);
    rows = await fetchMarks();
  }
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

/**
 * The columns a retry journey needs — deliberately NOT `state`, which holds
 * every question's frozen passage and answer key and is by far the largest
 * part of a session row.
 */
const chainColumns = {
  id: sessions.id,
  status: sessions.status,
  questionIds: sessions.questionIds,
  questionSetId: sessions.questionSetId,
  rootSessionId: sessions.rootSessionId,
  retryOfSessionId: sessions.retryOfSessionId,
  startedAt: sessions.startedAt,
  completedAt: sessions.completedAt,
  resultSummary: sessions.resultSummary,
};

type ChainRow = {
  [K in keyof typeof chainColumns]: SessionRow[K];
};

async function findOwnedChainRow(
  user: SessionUser,
  sessionId: string,
): Promise<ChainRow | undefined> {
  const [row] = await getDb()
    .select(chainColumns)
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
async function loadChain(user: SessionUser, sessionId: string): Promise<ChainRow[]> {
  // The whole journey in ONE read: its rows are those sharing the root id of
  // this session (looked up inside the same statement). Empty when the session
  // doesn't exist or isn't this student's.
  const journey = await getDb()
    .select(chainColumns)
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        sql`${sessions.rootSessionId} = (select root_session_id from sessions where id = ${sessionId} and user_id = ${user.id})`,
      ),
    )
    // Each retry starts after its parent finished, so start time is journey order.
    .orderBy(asc(sessions.startedAt), asc(sessions.id))
    .limit(MAX_CHAIN);
  if (journey.some((row) => row.id === sessionId)) return journey;

  // Sessions saved before root_session_id existed (and not backfilled), or an
  // unknown id: fall back to the session itself and the parent links.
  const start = await findOwnedChainRow(user, sessionId);
  if (!start) throw new TestSessionError("Test not found.");

  const chain: ChainRow[] = [start];
  while (chain.length < MAX_CHAIN) {
    const parentId = chain[0]?.retryOfSessionId;
    if (!parentId) break;
    const parent = await findOwnedChainRow(user, parentId);
    if (!parent) break;
    chain.unshift(parent);
  }
  while (chain.length < MAX_CHAIN) {
    const tail = chain[chain.length - 1];
    if (!tail) break;
    const [child] = await getDb()
      .select(chainColumns)
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
    .select({ id: sessions.id, status: sessions.status })
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

  const parent = await findOwnedChainRow(user, parentSessionId);
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
  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);
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
      // The stored roll-up is written once a round is fully marked; only a
      // round without one (marking still pending) is recomputed.
      const summary =
        row.status === "completed"
          ? (parseStoredSummary(row.resultSummary) ??
            (await getTestResults(user, row.id)).summary)
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
