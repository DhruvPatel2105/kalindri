import "server-only";

/**
 * Practice ("learn") mode: all of a set's questions on one page; the student
 * answers a question, presses Answer to see the correct answer and what they
 * got wrong, and can Try Again as often as they like.
 *
 * Kept apart from Test, by design:
 *   - Attempts live in a `sessions` row with mode = 'drill' (tests use
 *     'practice'), one open session per student per set. Every test query —
 *     history, dashboards, mastery, "Continue" — filters on test sessions, so
 *     Practice never reaches them.
 *   - Practice attempts have counts_toward_stats = false and the session is
 *     not scored for analytics.
 *   - Nothing is ever overwritten: each Answer press is a new `attempts` row
 *     with the question frozen as it was (payload, type, version, scoring
 *     rules), exactly like a test attempt; Try Again just allows another.
 *
 * Answers are PREFETCHED (explicit product decision): loadLearnSet sends each
 * question's answer key with the page, hidden, so pressing Answer displays
 * the result immediately — the browser builds it with the same review code
 * the server uses. answerLearnQuestion then records the attempt in the
 * background. Practice also lets the student press Answer whether or not
 * they have tried the question (this differs from the Test rule "no model
 * answers before an attempt"); a reveal without an attempt is saved as an
 * 'abandoned' attempt (no response), so study behaviour stays visible without
 * counting as an answer.
 *
 * Content protection (CLAUDE.md): because the answers are in the page, a
 * student who opens the browser's developer tools can read a Practice set's
 * answers before pressing Answer. That is accepted for Practice, where the
 * answers are one click away anyway. It must NEVER be done for a Test before
 * submission. Nothing here may be described as protection.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { attempts, questionBookmarks, questions, questionSets, scores, sessions } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";
import { isDeterministicType } from "@/lib/scoring/registry";

import type { BookmarkColor } from "./bookmarkColors";
import { toClientQuestion, type ClientQuestion } from "./clientQuestion";
import type { Difficulty } from "./questionList";
import { questionHeader } from "./questionHeader";
import { validateDeterministicResponse } from "./responseSchemas";
import { buildQuestionReview, type QuestionReview } from "./reviewModel";
import { scoringRulesFor } from "./scoringRules";
import { QuestionNotAvailableError, recordAttemptScore } from "./testEngine";
import { resultKind, type QuestionResultKind } from "./testResults";
import { isAnswered, type QuestionSnapshot } from "./testState";

type SessionUser = Awaited<ReturnType<typeof requireActiveSession>>;

/** A Practice request the student can fix (nothing attempted yet, malformed answer). */
export class LearnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnError";
  }
}

export interface LearnQuestion {
  id: string;
  /** 1-based position in the set. */
  number: number;
  header: string;
  /** The question's own rating, else the set's, else null (shown as "Unrated"). */
  difficulty: Difficulty | null;
  /** What the answer input shows: shuffled, no answer key visible in it. */
  client: ClientQuestion;
  /**
   * The full question INCLUDING its answer key, prefetched with the page and
   * kept hidden in the browser so pressing Answer shows the result instantly
   * (computed in the browser by the same review code the server uses) with
   * no request to wait for. See the content-protection note at the top.
   */
  answerKey: QuestionSnapshot;
  /** How the student's most recent attempt went; null if never attempted. */
  lastKind: QuestionResultKind | null;
  /** How many times they've pressed Answer on this question. */
  attempts: number;
  /** The student's bookmark colour on this question, if any. */
  bookmark: BookmarkColor | null;
}

export interface LearnSet {
  setId: string;
  title: string;
  type: QuestionType;
  questions: LearnQuestion[];
}

/** The only set columns Practice reads (never `select *`). */
const setColumns = {
  id: questionSets.id,
  title: questionSets.title,
  difficulty: questionSets.difficulty,
  questionIds: questionSets.questionIds,
};

/** A set this student may use: their org's, of this type, published and active. */
function visibleSet(user: SessionUser, type: QuestionType, setId: string) {
  return and(
    eq(questionSets.id, setId),
    eq(questionSets.orgId, user.orgId),
    eq(questionSets.type, type),
    eq(questionSets.status, "published"),
    eq(questionSets.isActive, true),
  );
}

async function findPublishedSet(user: SessionUser, type: QuestionType, setId: string) {
  const [set] = await getDb()
    .select(setColumns)
    .from(questionSets)
    .where(visibleSet(user, type, setId))
    .limit(1);
  if (!set) {
    throw new QuestionNotAvailableError(`Question set ${setId} is not an available ${type} set.`);
  }
  return set;
}

/** The student's open Practice session for this set, if they have one. */
async function findOpenLearnSession(user: SessionUser, setId: string) {
  const [open] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        eq(sessions.mode, "drill"),
        eq(sessions.questionSetId, setId),
        eq(sessions.status, "in_progress"),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);
  return open;
}

export async function loadLearnSet(
  user: SessionUser,
  type: QuestionType,
  setId: string,
): Promise<LearnSet> {
  const db = getDb();

  // ONE batch of four independent reads, all started together — so opening a
  // set costs a single database round trip instead of two. The set's question
  // ids are looked up INSIDE the questions and bookmarks queries (a subquery
  // on the same visible-set conditions), so they don't have to wait for the
  // set row to come back first; and the attempts query only needs the set id
  // from the URL. Authorization is unchanged: if the set isn't visible to
  // this student the set query finds nothing, we stop with "not available",
  // and the other results are discarded — and each of them is also
  // restricted to this student / org / published / active by its own
  // conditions.
  const setQuestionIds = sql`(select unnest(${questionSets.questionIds}) from ${questionSets} where ${visibleSet(user, type, setId)})`;
  const [[set], rows, bookmarkRows, done] = await Promise.all([
    db.select(setColumns).from(questionSets).where(visibleSet(user, type, setId)).limit(1),
    db
      .select({
        id: questions.id,
        type: questions.type,
        payload: questions.payload,
        version: questions.version,
        difficulty: questions.difficulty,
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
    db
      .select({ questionId: questionBookmarks.questionId, color: questionBookmarks.color })
      .from(questionBookmarks)
      .where(
        and(
          eq(questionBookmarks.userId, user.id),
          sql`${questionBookmarks.questionId} in ${setQuestionIds}`,
        ),
      ),
    db
      .select({
        questionId: attempts.questionId,
        score: scores.score,
        maxScore: scores.maxScore,
      })
      .from(attempts)
      .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
      .leftJoin(scores, eq(scores.attemptId, attempts.id))
      .where(
        and(
          eq(sessions.userId, user.id),
          eq(sessions.mode, "drill"),
          eq(sessions.questionSetId, setId),
          eq(sessions.status, "in_progress"),
          eq(attempts.status, "submitted"),
        ),
      )
      .orderBy(asc(attempts.submittedAt), asc(attempts.id)),
  ]);

  if (!set) {
    throw new QuestionNotAvailableError(`Question set ${setId} is not an available ${type} set.`);
  }
  const bookmarks = new Map(bookmarkRows.map((row) => [row.questionId, row.color]));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = set.questionIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  if (ordered.length === 0) {
    throw new QuestionNotAvailableError(`Question set ${setId} has no published questions.`);
  }

  // Attempts so far and how the latest one went, per question.
  const history = new Map<string, { attempts: number; lastKind: QuestionResultKind | null }>();
  for (const row of done) {
    const kind = resultKind({
      answered: true,
      score: row.score !== null ? Number(row.score) : null,
      maxScore: row.maxScore !== null ? Number(row.maxScore) : null,
    });
    const previous = history.get(row.questionId);
    history.set(row.questionId, { attempts: (previous?.attempts ?? 0) + 1, lastKind: kind });
  }

  return {
    setId: set.id,
    title: set.title,
    type,
    questions: ordered.map((row, index) => {
      const client = toClientQuestion({ id: row.id, type: row.type, payload: row.payload });
      const seen = history.get(row.id);
      return {
        id: row.id,
        number: index + 1,
        header: questionHeader(client),
        difficulty: row.difficulty ?? set.difficulty ?? null,
        client,
        answerKey: { id: row.id, type: row.type, payload: row.payload, version: row.version },
        lastKind: seen?.lastKind ?? null,
        attempts: seen?.attempts ?? 0,
        bookmark: bookmarks.get(row.id) ?? null,
      };
    }),
  };
}

/**
 * Reveals one Practice question's correct answer and marks the student's
 * answer if they gave one. The attempt is saved BEFORE it is scored (CLAUDE.md
 * #12). With no answer given it is a "reveal": saved as an 'abandoned'
 * attempt with no response, not scored and not counted as an attempt.
 */
export async function answerLearnQuestion(
  user: SessionUser,
  input: { type: QuestionType; setId: string; questionId: string; response: unknown },
): Promise<{ review: QuestionReview; attemptNumber: number }> {
  const db = getDb();

  // The set, the question and any open Practice session don't depend on each
  // other: read them together.
  const [set, [question], openSession] = await Promise.all([
    findPublishedSet(user, input.type, input.setId),
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
          eq(questions.id, input.questionId),
          eq(questions.orgId, user.orgId),
          eq(questions.type, input.type),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
        ),
      )
      .limit(1),
    findOpenLearnSession(user, input.setId),
  ]);
  if (!set.questionIds.includes(input.questionId)) {
    throw new LearnError("That question isn't in this set.");
  }
  if (!question) throw new QuestionNotAvailableError("That question is no longer available.");

  if (!isDeterministicType(question.type)) {
    throw new LearnError(`${question.type} questions can't be practised yet.`);
  }
  const validation = validateDeterministicResponse(question.type, input.response);
  if (!validation.success) throw new LearnError(`Invalid answer: ${validation.error}`);
  const answered = isAnswered(validation.data);

  // One open Practice session per student per set, created on the first Answer.
  let session = openSession;
  if (!session) {
    [session] = await db
      .insert(sessions)
      .values({
        orgId: user.orgId,
        userId: user.id,
        mode: "drill",
        questionSetId: set.id,
        questionIds: set.questionIds,
        isTimed: false,
        isScoredForAnalytics: false,
      })
      // One open Practice session per student per set (unique index): if
      // another tab created it a moment ago, use that one.
      .onConflictDoNothing()
      .returning();
    session ??= await findOpenLearnSession(user, set.id);
  }
  if (!session) throw new Error("Failed to start the Practice session.");

  const now = new Date();
  const [attempt] = await db
    .insert(attempts)
    .values({
      orgId: user.orgId,
      sessionId: session.id,
      userId: user.id,
      questionId: question.id,
      // The question exactly as the student saw it, answer key included, so
      // this attempt's review never changes if the question is edited later.
      questionSnapshot: question.payload,
      questionType: question.type,
      questionVersion: question.version,
      scoringRules: scoringRulesFor(question.type),
      response: answered ? validation.data : null,
      status: answered ? "submitted" : "abandoned",
      isCorrect: answered ? null : false, // an answered one is set when scored
      // Practice stays out of question and student statistics.
      countsTowardStats: false,
      startedAt: now,
      submittedAt: now,
    })
    .returning({ id: attempts.id });
  if (!attempt) throw new Error("Failed to save your answer.");

  if (answered) {
    await recordAttemptScore({
      orgId: user.orgId,
      attemptId: attempt.id,
      type: question.type,
      payload: question.payload,
      response: validation.data,
    });
  }

  // Attempts so far: reveals without an answer don't count.
  const earlier = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.sessionId, session.id),
        eq(attempts.questionId, question.id),
        eq(attempts.status, "submitted"),
      ),
    );

  return {
    review: buildQuestionReview(
      { id: question.id, type: question.type, payload: question.payload, version: question.version },
      answered ? validation.data : undefined,
    ),
    attemptNumber: earlier.length,
  };
}

/**
 * The set Practice opens straight into, so the student never has to pick one
 * first: the set they most recently practised, else the first published set
 * of the type (oldest first). Null if the type has no published sets.
 */
export async function pickPracticeSetId(
  user: SessionUser,
  type: QuestionType,
): Promise<string | null> {
  const db = getDb();
  const visible = and(
    eq(questionSets.orgId, user.orgId),
    eq(questionSets.type, type),
    eq(questionSets.status, "published"),
    eq(questionSets.isActive, true),
  );

  const [recent] = await db
    .select({ setId: questionSets.id })
    .from(sessions)
    .innerJoin(questionSets, eq(sessions.questionSetId, questionSets.id))
    .where(and(eq(sessions.userId, user.id), eq(sessions.mode, "drill"), visible))
    .orderBy(desc(sessions.startedAt))
    .limit(1);
  if (recent) return recent.setId;

  const [first] = await db
    .select({ setId: questionSets.id })
    .from(questionSets)
    .where(visible)
    .orderBy(asc(questionSets.createdAt), asc(questionSets.id))
    .limit(1);
  return first?.setId ?? null;
}
