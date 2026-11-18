/**
 * How much practice content is live, per question type: published questions
 * in the bank and published question sets students can sit. Counts only — no
 * content — for the dashboard cards.
 *
 * Takes `db` as a parameter so it stays a plain module (no `server-only`).
 */

import { and, count, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { questions, questionSets } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

type Database = PostgresJsDatabase<typeof schema>;

export interface TypeCounts {
  questions: number;
  sets: number;
}

export async function getLibraryCounts(
  db: Database,
  orgId: string,
): Promise<Map<QuestionType, TypeCounts>> {
  const [questionRows, setRows] = await Promise.all([
    db
      .select({ type: questions.type, total: count() })
      .from(questions)
      .where(
        and(
          eq(questions.orgId, orgId),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
        ),
      )
      .groupBy(questions.type),
    db
      .select({ type: questionSets.type, total: count() })
      .from(questionSets)
      .where(
        and(
          eq(questionSets.orgId, orgId),
          eq(questionSets.status, "published"),
          eq(questionSets.isActive, true),
        ),
      )
      .groupBy(questionSets.type),
  ]);

  const result = new Map<QuestionType, TypeCounts>();
  for (const row of questionRows) {
    result.set(row.type, { questions: Number(row.total), sets: 0 });
  }
  for (const row of setRows) {
    const existing = result.get(row.type) ?? { questions: 0, sets: 0 };
    result.set(row.type, { ...existing, sets: Number(row.total) });
  }
  return result;
}
