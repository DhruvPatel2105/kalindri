/**
 * Question types whose Practice page offers named banks to choose between,
 * instead of a "how many questions" box. Each bank is a published question set
 * with the title below (kept in numbered order); selecting one practises that
 * bank's questions in order. Tests offer the same banks, plus all of them
 * together (lib/practice/testBanks.ts).
 */

import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { questions, questionSets } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

type Database = PostgresJsDatabase<typeof schema>;

export interface PracticeBankConfig {
  /** The question set's title — how the bank's set is found. */
  setTitle: string;
  blurb: string;
}

export const PRACTICE_BANKS: Partial<Record<QuestionType, readonly PracticeBankConfig[]>> = {
  FIB_RW: [
    { setTitle: "Main Question Bank", blurb: "The original questions." },
    { setTitle: "Secondary Question Bank", blurb: "Additional questions for more practice." },
  ],
};

export function hasPracticeBanks(type: QuestionType): boolean {
  return (PRACTICE_BANKS[type]?.length ?? 0) > 0;
}

export interface PracticeBank {
  setId: string;
  title: string;
  blurb: string;
  questionCount: number;
  /** The bank's live (published, active) question ids, in numbered order. Ids only — never content. */
  questionIds: string[];
}

/**
 * The banks students can start, in the configured order, each with how many of
 * its questions are live (published and active). A bank whose set doesn't
 * exist yet is left out. Counts only — never question content.
 */
export async function getPracticeBanks(
  db: Database,
  params: { orgId: string; type: QuestionType },
): Promise<PracticeBank[]> {
  const configs = PRACTICE_BANKS[params.type] ?? [];
  if (configs.length === 0) return [];

  const sets = await db
    .select({ id: questionSets.id, title: questionSets.title, questionIds: questionSets.questionIds })
    .from(questionSets)
    .where(
      and(
        eq(questionSets.orgId, params.orgId),
        eq(questionSets.type, params.type),
        eq(questionSets.status, "published"),
        eq(questionSets.isActive, true),
        eq(questionSets.isBank, false),
        inArray(questionSets.title, configs.map((c) => c.setTitle)),
      ),
    );
  const allIds = sets.flatMap((set) => set.questionIds);
  const live =
    allIds.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db
              .select({ id: questions.id })
              .from(questions)
              .where(
                and(
                  inArray(questions.id, allIds),
                  eq(questions.orgId, params.orgId),
                  eq(questions.status, "published"),
                  eq(questions.isActive, true),
                ),
              )
          ).map((row) => row.id),
        );

  return configs.flatMap((config) => {
    const set = sets.find((s) => s.title === config.setTitle);
    if (!set) return [];
    const questionIds = set.questionIds.filter((id) => live.has(id));
    return [
      {
        setId: set.id,
        title: config.setTitle,
        blurb: config.blurb,
        questionCount: questionIds.length,
        questionIds,
      },
    ];
  });
}
