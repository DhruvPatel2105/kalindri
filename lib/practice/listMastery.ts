/**
 * The attempts mastery is computed from (lib/practice/mastery.ts): for each
 * question, the student's LATEST answered and marked attempt in a COMPLETED
 * practice session, full or retry. Postgres keeps only that one row per
 * question (DISTINCT ON), so this returns one row per unique question rather
 * than every attempt the student has ever made. Never question content.
 * Takes `db` as a parameter so it stays a plain module.
 */

import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { attempts, sessions } from "@/lib/db/schema";

import type { MasteryAttempt } from "./mastery";

type Database = PostgresJsDatabase<typeof schema>;

export async function getMasteryAttempts(
  db: Database,
  params: { userId: string },
): Promise<MasteryAttempt[]> {
  const rows = await db
    .selectDistinctOn([attempts.questionId], {
      questionId: attempts.questionId,
      type: attempts.questionType,
      isCorrect: attempts.isCorrect,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(
      and(
        eq(attempts.userId, params.userId),
        // An answered, marked attempt — a blank one ('abandoned') is not an answer.
        eq(attempts.status, "submitted"),
        isNotNull(attempts.isCorrect),
        isNotNull(attempts.submittedAt),
        // Completed practice sessions only (not in progress, not abandoned).
        eq(sessions.status, "completed"),
        isNotNull(sessions.sessionType),
      ),
    )
    // DISTINCT ON keeps the first row per question in this order: the latest.
    .orderBy(attempts.questionId, desc(attempts.submittedAt), desc(attempts.id));

  return rows.flatMap((row) =>
    row.type && row.submittedAt
      ? [
          {
            questionId: row.questionId,
            type: row.type,
            isCorrect: row.isCorrect,
            submittedAt: row.submittedAt,
          },
        ]
      : [],
  );
}
