/**
 * Metadata-only listing of the published question sets of one type, for the
 * browse page. CLAUDE.md content protection: list views return metadata only
 * and never payload — this reads `question_sets` (title, difficulty, the id
 * array's length) and never touches the `questions` table at all.
 *
 * Takes `db` as a parameter instead of calling getDb() so it stays a plain
 * module (no `server-only`), callable from the page and from scripts.
 */

import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { questions, questionSets, sessions } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

import {
  countDifficulties,
  PAGE_SIZE,
  paginate,
  type Difficulty,
  type DifficultyMix,
  type Pagination,
} from "./questionList";

type Database = PostgresJsDatabase<typeof schema>;

export interface QuestionSetSummary {
  id: string;
  title: string;
  /** The set's own rating; null = none (see difficultyMix and describeSetDifficulty). */
  difficulty: Difficulty | null;
  /** How the set's questions are rated — only counts, never question content. */
  difficultyMix: DifficultyMix;
  questionCount: number;
  /** The student has an unfinished attempt at this set (the button says Continue). */
  inProgress: boolean;
}

export interface QuestionSetPage {
  total: number;
  pagination: Pagination;
  items: QuestionSetSummary[];
}

export async function getQuestionSetPage(
  db: Database,
  params: {
    orgId: string;
    userId: string;
    type: QuestionType;
    requestedPage: number;
  },
): Promise<QuestionSetPage> {
  // Same visibility rules the engine applies when a set is started.
  const where = and(
    eq(questionSets.orgId, params.orgId),
    eq(questionSets.type, params.type),
    eq(questionSets.status, "published"),
    eq(questionSets.isActive, true),
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(questionSets)
    .where(where);
  const total = Number(totalRow?.value ?? 0);

  const pagination = paginate(total, params.requestedPage, PAGE_SIZE);

  const rows = await db
    .select({
      id: questionSets.id,
      title: questionSets.title,
      difficulty: questionSets.difficulty,
      questionIds: questionSets.questionIds,
      questionCount: sql<number>`coalesce(cardinality(${questionSets.questionIds}), 0)`,
    })
    .from(questionSets)
    .where(where)
    // Oldest first, id as a tiebreaker so pages never overlap or skip rows.
    .orderBy(asc(questionSets.createdAt), asc(questionSets.id))
    .limit(PAGE_SIZE)
    .offset(pagination.offset);

  // The difficulty rating of each of this page's questions (the rating only —
  // never the payload), to describe each set as easy / medium / hard / mixed.
  const ratingById = new Map<string, Difficulty | null>();
  const allIds = [...new Set(rows.flatMap((row) => row.questionIds))];
  if (allIds.length > 0) {
    const ratings = await db
      .select({ id: questions.id, difficulty: questions.difficulty })
      .from(questions)
      .where(inArray(questions.id, allIds));
    for (const r of ratings) ratingById.set(r.id, r.difficulty);
  }

  // Which of THIS page's sets the student has half-finished.
  const openSetIds = new Set<string>();
  if (rows.length > 0) {
    const open = await db
      .select({ setId: sessions.questionSetId })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, params.userId),
          // Tests only: a Practice (learn) session is never "Continue" on a test.
          eq(sessions.mode, "practice"),
          eq(sessions.status, "in_progress"),
          // Only whole-set attempts; a retry in progress isn't "Continue" on the set.
          isNull(sessions.retryOfSessionId),
          inArray(
            sessions.questionSetId,
            rows.map((row) => row.id),
          ),
        ),
      );
    for (const row of open) if (row.setId) openSetIds.add(row.setId);
  }

  return {
    total,
    pagination,
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      difficultyMix: countDifficulties(row.questionIds.map((id) => ratingById.get(id) ?? null)),
      questionCount: Number(row.questionCount),
      inProgress: openSetIds.has(row.id),
    })),
  };
}
