/**
 * The question bank behind "Mixed tests": reading a student's rotation state
 * from tables that already exist, and maintaining the one hidden "bank set"
 * per org and question type that a mixed test is recorded against (so mixed
 * tests reuse sessions, attempts, history, results, retries and dashboards
 * unchanged). No new tables: rotation is derived from `attempts`.
 *
 * Takes `db` as a parameter so it stays a plain module (no `server-only`).
 */

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { attempts, questions, questionSets, sessions } from "@/lib/db/schema";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import type { QuestionType } from "@/lib/questions/types";

import { currentRound } from "./rotation";

type Database = PostgresJsDatabase<typeof schema>;

export interface RotationInputs {
  /** Every published, active question of the type in the org, in bank order. */
  pool: string[];
  /** The student's answered attempts at this type, one array per test, oldest first. */
  history: string[][];
  /** Question ids inside the student's unfinished tests of this type. */
  reserved: string[];
}

/**
 * The three reads rotation needs, run together (one round trip). "Answered
 * attempt" = an attempts row with status 'submitted' that counts toward
 * stats: that is exactly an answered question in a submitted full test.
 * Blank questions are 'abandoned', retries and Practice never count, so none
 * of those mark a question as attempted.
 */
export async function loadRotationInputs(
  db: Database,
  params: { userId: string; orgId: string; type: QuestionType },
): Promise<RotationInputs> {
  const [poolRows, attemptRows, openRows] = await Promise.all([
    db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.orgId, params.orgId),
          eq(questions.type, params.type),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
        ),
      )
      .orderBy(asc(questions.createdAt), asc(questions.id)),
    db
      .select({ sessionId: attempts.sessionId, questionId: attempts.questionId })
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, params.userId),
          eq(attempts.questionType, params.type),
          eq(attempts.status, "submitted"),
          eq(attempts.countsTowardStats, true),
        ),
      )
      .orderBy(asc(attempts.submittedAt), asc(attempts.sessionId), asc(attempts.id)),
    db
      .select({ questionIds: sessions.questionIds })
      .from(sessions)
      .innerJoin(questionSets, eq(sessions.questionSetId, questionSets.id))
      .where(
        and(
          eq(sessions.userId, params.userId),
          eq(sessions.mode, "practice"),
          eq(sessions.status, "in_progress"),
          isNull(sessions.retryOfSessionId),
          eq(questionSets.type, params.type),
        ),
      ),
  ]);

  const history: string[][] = [];
  let lastSession: string | null = null;
  for (const row of attemptRows) {
    if (row.sessionId !== lastSession) {
      history.push([]);
      lastSession = row.sessionId;
    }
    history[history.length - 1]?.push(row.questionId);
  }

  return {
    pool: poolRows.map((row) => row.id),
    history,
    reserved: openRows.flatMap((row) => row.questionIds ?? []),
  };
}

export interface BankSet {
  id: string;
  title: string;
}

/**
 * The org's hidden bank set for a type: created on first use, and its
 * question_ids kept equal to the current bank. Safe if two requests create it
 * at once (a unique index allows one; the loser reads the winner's).
 */
export async function getBankSet(
  db: Database,
  params: { orgId: string; type: QuestionType; pool: readonly string[] },
): Promise<BankSet> {
  const find = () =>
    db
      .select({ id: questionSets.id, title: questionSets.title, questionIds: questionSets.questionIds })
      .from(questionSets)
      .where(
        and(
          eq(questionSets.orgId, params.orgId),
          eq(questionSets.type, params.type),
          eq(questionSets.isBank, true),
        ),
      )
      .limit(1);

  let [set] = await find();
  if (!set) {
    await db
      .insert(questionSets)
      .values({
        orgId: params.orgId,
        type: params.type,
        title: `Mixed test — ${QUESTION_TYPE_LABELS[params.type]}`,
        questionIds: [...params.pool],
        status: "published",
        isActive: true,
        isBank: true,
      })
      .onConflictDoNothing();
    [set] = await find();
  }
  if (!set) throw new Error("Failed to create the mixed-test set.");

  // Keep the set's id list equal to the current bank (new questions appear).
  const same =
    set.questionIds.length === params.pool.length &&
    set.questionIds.every((id, i) => id === params.pool[i]);
  if (!same) {
    await db
      .update(questionSets)
      .set({ questionIds: [...params.pool], updatedAt: new Date() })
      .where(eq(questionSets.id, set.id));
  }
  return { id: set.id, title: set.title };
}

export interface BankSummary {
  setId: string;
  /** Questions in the bank. */
  poolSize: number;
  /** Not yet answered in the student's current round (and not in an open test). */
  remaining: number;
  /** Rounds of the whole bank the student has completed. */
  roundsCompleted: number;
  /** The student has an unfinished mixed test. */
  inProgress: boolean;
}

/** What the Tests page shows on the Mixed test card; null if the type has no questions yet. */
export async function getBankSummary(
  db: Database,
  params: { userId: string; orgId: string; type: QuestionType },
): Promise<BankSummary | null> {
  const inputs = await loadRotationInputs(db, params);
  if (inputs.pool.length === 0) return null;

  const set = await getBankSet(db, { orgId: params.orgId, type: params.type, pool: inputs.pool });
  const { attempted, roundsCompleted } = currentRound(inputs.pool, inputs.history);
  const blocked = new Set(inputs.reserved);

  const [open] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, params.userId),
        eq(sessions.questionSetId, set.id),
        eq(sessions.mode, "practice"),
        eq(sessions.status, "in_progress"),
        isNull(sessions.retryOfSessionId),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  return {
    setId: set.id,
    poolSize: inputs.pool.length,
    remaining: inputs.pool.filter((id) => !attempted.has(id) && !blocked.has(id)).length,
    roundsCompleted,
    inProgress: Boolean(open),
  };
}
