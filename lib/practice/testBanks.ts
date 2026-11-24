/**
 * Tests for question types with named banks (Fill in the Blanks): three ways
 * to sit one — the Main bank, the Secondary bank, or ALL the questions
 * together. Each is an ordinary test with the usual "how many questions"
 * choice and the same never-repeat-until-the-bank-is-done rotation, only over
 * its own pool of questions:
 *
 *   Main Question Bank       → the main bank's questions
 *   Secondary Question Bank  → the secondary bank's questions
 *   All Questions            → both banks (the type's hidden "mixed test" set)
 *
 * A student's history is per question, so answering a question in one test
 * counts as answered in the others that contain it.
 *
 * Takes `db` as a parameter so it stays a plain module (no `server-only`).
 */

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { sessions } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

import { getBankSet, loadRotationInputs } from "./bank";
import { getPracticeBanks, PRACTICE_BANKS } from "./practiceBanks";
import { currentRound } from "./rotation";

type Database = PostgresJsDatabase<typeof schema>;

export const ALL_QUESTIONS_TITLE = "All Questions";

export interface TestBank {
  setId: string;
  /** "all" is the combined test. */
  kind: "bank" | "all";
  title: string;
  blurb: string;
  poolSize: number;
  /** Not yet answered this round (and not in an open test). */
  remaining: number;
  roundsCompleted: number;
  /** The student has an unfinished test of this one. */
  inProgress: boolean;
}

/**
 * The tests to offer for a type with banks: each bank, then all of them
 * together. Empty for a type without banks. Counts only — never content.
 */
export async function getTestBanks(
  db: Database,
  params: { userId: string; orgId: string; type: QuestionType },
): Promise<TestBank[]> {
  const banks = await getPracticeBanks(db, { orgId: params.orgId, type: params.type });
  if (banks.length === 0) return [];

  const allPool = [...new Set(banks.flatMap((bank) => bank.questionIds))];
  const [inputs, allSet] = await Promise.all([
    loadRotationInputs(db, { ...params, pool: allPool }),
    getBankSet(db, { orgId: params.orgId, type: params.type, pool: allPool, title: ALL_QUESTIONS_TITLE }),
  ]);

  const entries = [
    ...banks.map((bank) => ({ kind: "bank" as const, setId: bank.setId, title: bank.title, blurb: bank.blurb, pool: bank.questionIds })),
    {
      kind: "all" as const,
      setId: allSet.id,
      title: ALL_QUESTIONS_TITLE,
      blurb: "Questions from every bank together.",
      pool: allPool,
    },
  ];

  const open = await db
    .select({ setId: sessions.questionSetId })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, params.userId),
        eq(sessions.mode, "practice"),
        eq(sessions.status, "in_progress"),
        isNull(sessions.retryOfSessionId),
        inArray(sessions.questionSetId, entries.map((entry) => entry.setId)),
      ),
    )
    .orderBy(desc(sessions.startedAt));
  const openSets = new Set(open.map((row) => row.setId));
  const blocked = new Set(inputs.reserved);

  return entries.map((entry) => {
    const { attempted, roundsCompleted } = currentRound(entry.pool, inputs.history);
    return {
      setId: entry.setId,
      kind: entry.kind,
      title: entry.title,
      blurb: entry.blurb,
      poolSize: entry.pool.length,
      remaining: entry.pool.filter((id) => !attempted.has(id) && !blocked.has(id)).length,
      roundsCompleted,
      inProgress: openSets.has(entry.setId),
    };
  });
}

/**
 * The pool a test of this set rotates over, for a type with banks: the bank's
 * own questions for a bank's set, every bank's questions for the type's
 * "mixed test" set. Null when the set isn't one of those (an ordinary set, or a
 * type without banks), so the caller falls back to its usual behaviour.
 */
export async function rotationPoolFor(
  db: Database,
  params: { orgId: string; type: QuestionType; set: { isBank: boolean; title: string } },
): Promise<string[] | null> {
  if (!PRACTICE_BANKS[params.type]) return null;
  const banks = await getPracticeBanks(db, { orgId: params.orgId, type: params.type });
  if (params.set.isBank) return [...new Set(banks.flatMap((bank) => bank.questionIds))];
  const bank = banks.find((candidate) => candidate.title === params.set.title);
  return bank ? bank.questionIds : null;
}

/** Whether `title` belongs to a bank set of this type. */
export function isBankSetTitle(type: QuestionType, title: string): boolean {
  return (PRACTICE_BANKS[type] ?? []).some((bank) => bank.setTitle === title);
}

