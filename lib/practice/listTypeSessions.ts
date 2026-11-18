/**
 * Every FINISHED practice session a student has (of one question type, or of
 * all of them) — the input to the progress dashboards
 * (lib/practice/typeStats.ts).
 * Metadata and the stored result roll-up only; never question content.
 *
 * Takes `db` as a parameter so it stays a plain module (no `server-only`).
 */

import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { questionSets, sessions } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

import { parseStoredSummary, type TestSummary } from "./testResults";

type Database = PostgresJsDatabase<typeof schema>;

export interface TypeSessionRow {
  sessionId: string;
  type: QuestionType;
  startedAt: Date;
  completedAt: Date;
  isRetry: boolean;
  /** Null for a session saved before summaries were stored; the caller fills it in. */
  summary: TestSummary | null;
}

export async function getFinishedSessions(
  db: Database,
  params: { userId: string; /** Omit for every type. */ type?: QuestionType },
): Promise<TypeSessionRow[]> {
  const rows = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      completedAt: sessions.completedAt,
      sessionType: sessions.sessionType,
      resultSummary: sessions.resultSummary,
      type: questionSets.type,
    })
    .from(sessions)
    .innerJoin(questionSets, eq(sessions.questionSetId, questionSets.id))
    .where(
      and(
        eq(sessions.userId, params.userId),
        eq(sessions.mode, "practice"),
        eq(sessions.status, "completed"),
        isNotNull(sessions.completedAt),
        ...(params.type ? [eq(questionSets.type, params.type)] : []),
      ),
    )
    .orderBy(asc(sessions.startedAt), asc(sessions.id));

  return rows.flatMap((row) =>
    row.completedAt
      ? [
          {
            sessionId: row.id,
            type: row.type,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            isRetry: row.sessionType === "INCORRECT_PRACTICE",
            summary: parseStoredSummary(row.resultSummary),
          },
        ]
      : [],
  );
}
