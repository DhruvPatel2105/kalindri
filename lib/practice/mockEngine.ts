import "server-only";

/**
 * The Reading Mock Test engine. A mock is an ordinary session (mode 'mock')
 * whose frozen question snapshots come from ALL five Reading question banks,
 * in the exam's sequence. Because a session already keeps each question's own
 * type, answers and marking rules, the existing autosave (saveTestProgress)
 * and submit (finishTest) work on it unchanged: every answer is kept in one
 * place as the student moves between question types, and each type is marked by
 * its own scorer. This file only adds what is new — building the mock, its
 * clock, and the per-type results.
 *
 * Mock sessions have no question set (question_set_id is null) and mode
 * 'mock', so they never appear in a question type's own test history, progress
 * or set lists. Their answered attempts do count toward question rotation, so a
 * student isn't served the same question again before finishing the bank.
 */

import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { attempts, questions, scores, sessions } from "@/lib/db/schema";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { isDeterministicType, scoreDeterministic } from "@/lib/scoring/registry";

import { loadRotationInputs } from "./bank";
import {
  MOCK_SEQUENCE,
  missingMockTypes,
  mockDeadline,
  planMockCounts,
  summarizeMock,
  type MockQuestionResult,
  type MockResults,
  type MockType,
} from "./mock";
import { selectRotation } from "./rotation";
import { QuestionNotAvailableError, scoreUnscoredAttempts } from "./testEngine";
import {
  buildTestState,
  clampIndex,
  emptyResponseFor,
  extractTestState,
  isAnswered,
  type QuestionSnapshot,
} from "./testState";

type SessionUser = { id: string; orgId: string };

export interface ActiveMock {
  sessionId: string;
  startedAt: Date;
  deadline: Date;
  currentIndex: number;
  /** Full snapshots INCLUDING answer keys — server side only; strip before the browser. */
  snapshots: QuestionSnapshot[];
  answers: Record<string, unknown>;
}

const openMockWhere = (user: SessionUser) =>
  and(eq(sessions.userId, user.id), eq(sessions.mode, "mock"), eq(sessions.status, "in_progress"));

function asActive(row: {
  id: string;
  startedAt: Date;
  currentItemIndex: number;
  state: unknown;
}): ActiveMock | null {
  const state = extractTestState(row.state);
  if (!state || state.snapshots.length === 0) return null;
  return {
    sessionId: row.id,
    startedAt: row.startedAt,
    deadline: mockDeadline(row.startedAt),
    currentIndex: clampIndex(row.currentItemIndex, state.snapshots.length),
    snapshots: state.snapshots,
    answers: state.answers,
  };
}

/** The student's unfinished mock, if any (no side effects). */
export async function findOpenMock(user: SessionUser): Promise<ActiveMock | null> {
  const [open] = await getDb()
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      currentItemIndex: sessions.currentItemIndex,
      state: sessions.state,
    })
    .from(sessions)
    .where(openMockWhere(user))
    .orderBy(asc(sessions.startedAt), asc(sessions.id))
    .limit(1);
  return open ? asActive(open) : null;
}

/** How many questions each Reading type has right now (published and active). */
export async function countMockBanks(user: SessionUser): Promise<Record<MockType, number>> {
  const rows = await getDb()
    .select({ type: questions.type, total: sql<number>`count(*)::int` })
    .from(questions)
    .where(
      and(
        eq(questions.orgId, user.orgId),
        eq(questions.status, "published"),
        eq(questions.isActive, true),
        inArray(questions.type, MOCK_SEQUENCE.map((s) => s.type)),
      ),
    )
    .groupBy(questions.type);
  const result = {} as Record<MockType, number>;
  for (const { type } of MOCK_SEQUENCE) {
    result[type] = Number(rows.find((row) => row.type === type)?.total ?? 0);
  }
  return result;
}

/**
 * Resumes the student's unfinished mock, or builds a new one: a random count
 * from each type's official range, drawn with the same never-repeat-until-the-
 * bank-is-done rotation the single-type tests use, frozen into the session in
 * the exam sequence.
 */
export async function startOrResumeMock(user: SessionUser): Promise<ActiveMock> {
  const existing = await findOpenMock(user);
  if (existing) return existing;

  const db = getDb();
  const available = await countMockBanks(user);
  const missing = missingMockTypes(available);
  if (missing.length > 0) {
    throw new QuestionNotAvailableError(
      `The Reading mock needs at least one question of every type. Missing: ${missing
        .map((type) => QUESTION_TYPE_LABELS[type])
        .join(", ")}.`,
    );
  }
  const counts = planMockCounts(available);

  const snapshots: QuestionSnapshot[] = [];
  for (const { type } of MOCK_SEQUENCE) {
    const inputs = await loadRotationInputs(db, { userId: user.id, orgId: user.orgId, type });
    const chosen = selectRotation({
      pool: inputs.pool,
      history: inputs.history,
      reserved: inputs.reserved,
      count: counts[type],
    });
    if (chosen.length === 0) continue;
    const rows = await db
      .select({ id: questions.id, type: questions.type, payload: questions.payload, version: questions.version })
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
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of chosen) {
      const row = byId.get(id);
      if (row) snapshots.push({ id: row.id, type: row.type, payload: row.payload, version: row.version });
    }
  }
  if (snapshots.length === 0) throw new QuestionNotAvailableError("No questions are available for a mock right now.");

  const sessionId = randomUUID();
  const [created] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      orgId: user.orgId,
      userId: user.id,
      mode: "mock",
      questionIds: snapshots.map((s) => s.id),
      currentItemIndex: 0,
      state: buildTestState(snapshots),
      isTimed: true,
    })
    .returning({ id: sessions.id, startedAt: sessions.startedAt });
  if (!created) throw new Error("Failed to start the mock.");

  // Two tabs starting at once could both insert: keep the earliest, drop ours
  // (it has no answers yet) so there is only ever one open mock.
  const [first] = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      currentItemIndex: sessions.currentItemIndex,
      state: sessions.state,
    })
    .from(sessions)
    .where(openMockWhere(user))
    .orderBy(asc(sessions.startedAt), asc(sessions.id))
    .limit(1);
  if (first && first.id !== created.id) {
    await db.delete(sessions).where(and(eq(sessions.id, created.id), eq(sessions.userId, user.id)));
    const winner = asActive(first);
    if (winner) return winner;
  }

  return {
    sessionId: created.id,
    startedAt: created.startedAt,
    deadline: mockDeadline(created.startedAt),
    currentIndex: 0,
    snapshots,
    answers: {},
  };
}

export interface MockResultsView {
  sessionId: string;
  startedAt: Date;
  completedAt: Date | null;
  results: MockResults;
}

/**
 * A finished mock's results, from the saved attempts and their marks. The
 * session must be this student's mock and completed; otherwise null. Any
 * answer that has no mark yet (a scorer failed) is marked again here first,
 * so a failed marking is retried without the student re-answering.
 */
export async function getMockResults(user: SessionUser, sessionId: string): Promise<MockResultsView | null> {
  const db = getDb();
  const [session] = await db
    .select({ id: sessions.id, status: sessions.status, startedAt: sessions.startedAt, completedAt: sessions.completedAt })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id), eq(sessions.mode, "mock")))
    .limit(1);
  if (!session || session.status !== "completed") return null;

  const read = () =>
    db
      .select({
        type: attempts.questionType,
        status: attempts.status,
        score: scores.score,
        maxScore: scores.maxScore,
        questionId: attempts.questionId,
        response: attempts.response,
      })
      .from(attempts)
      .leftJoin(scores, and(eq(scores.attemptId, attempts.id), eq(scores.trait, "overall")))
      .where(and(eq(attempts.sessionId, sessionId), eq(attempts.userId, user.id)))
      .orderBy(asc(attempts.id));

  let rows = await read();
  if (rows.some((row) => row.status === "submitted" && row.score === null)) {
    await scoreUnscoredAttempts(sessionId);
    rows = await read();
  }

  // A blank question has no mark row; its maximum comes from the frozen question.
  const maxForBlank = await blankMaximums(sessionId);
  const results: MockQuestionResult[] = rows.flatMap((row) =>
    row.type
      ? [
          {
            type: row.type,
            answered: row.status === "submitted" && isAnswered(row.response),
            score: row.score !== null ? Number(row.score) : null,
            maxScore: row.maxScore !== null ? Number(row.maxScore) : (maxForBlank.get(row.questionId) ?? null),
          },
        ]
      : [],
  );
  return { sessionId, startedAt: session.startedAt, completedAt: session.completedAt, results: summarizeMock(results) };
}

async function blankMaximums(sessionId: string): Promise<Map<string, number>> {
  const [session] = await getDb()
    .select({ state: sessions.state })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const state = session ? extractTestState(session.state) : null;
  const result = new Map<string, number>();
  for (const snapshot of state?.snapshots ?? []) {
    if (!isDeterministicType(snapshot.type)) continue;
    try {
      result.set(
        snapshot.id,
        scoreDeterministic(snapshot.type, snapshot.payload as never, emptyResponseFor(snapshot.type) as never).maxScore,
      );
    } catch {
      // no maximum known for this one
    }
  }
  return result;
}
