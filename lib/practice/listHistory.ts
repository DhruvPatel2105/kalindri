/**
 * A student's practice history: every practice test they've started, newest
 * first, each one its own row. Nothing here overwrites or merges sessions — a
 * retake or a retry is a separate session with its own attempts, so the list
 * is simply the sessions table read back.
 *
 * Metadata only, like the browse page: titles, dates, counts and the stored
 * result summary. No question content or answer keys.
 *
 * Takes `db` as a parameter instead of calling getDb() so it stays a plain
 * module (no `server-only`), callable from the page and from scripts.
 */

import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { questionSets, sessions } from "@/lib/db/schema";
import type { QuestionType } from "@/lib/questions/types";

import { fetchPage } from "./fetchPage";
import { PAGE_SIZE, type Pagination } from "./questionList";
import { retryDepths, retryLabel } from "./retry";
import { parseStoredSummary, type TestSummary } from "./testResults";

type Database = PostgresJsDatabase<typeof schema>;

export interface HistoryItem {
  sessionId: string;
  setId: string;
  setTitle: string;
  type: QuestionType;
  status: "in_progress" | "completed";
  /** 0 = an original test, 1 = first retry, … */
  depth: number;
  label: string;
  isRetry: boolean;
  questionCount: number;
  startedAt: Date;
  completedAt: Date | null;
  /** The stored result roll-up; null until one exists (the page fills it in). */
  summary: TestSummary | null;
}

export interface HistoryPage {
  total: number;
  pagination: Pagination;
  items: HistoryItem[];
}

export async function getHistoryPage(
  db: Database,
  params: { userId: string; requestedPage: number; /** Only this question type (the per-type dashboard). */ type?: QuestionType },
): Promise<HistoryPage> {
  // Practice tests only (sessions made by the test engine have a set); an
  // abandoned session isn't history.
  const where = and(
    eq(sessions.userId, params.userId),
    eq(sessions.mode, "practice"),
    isNotNull(sessions.questionSetId),
    inArray(sessions.status, ["in_progress", "completed"]),
    ...(params.type ? [eq(questionSets.type, params.type)] : []),
  );

  const { total, pagination, rows } = await fetchPage(
    params.requestedPage,
    PAGE_SIZE,
    async () => {
      // The set is only joined when filtering by its type.
      const base = db.select({ value: count() }).from(sessions);
      const [row] = await (params.type
        ? base.innerJoin(questionSets, eq(sessions.questionSetId, questionSets.id)).where(where)
        : base.where(where));
      return Number(row?.value ?? 0);
    },
    (offset) =>
      db
        .select({
          id: sessions.id,
          setId: sessions.questionSetId,
          status: sessions.status,
          sessionType: sessions.sessionType,
          rootSessionId: sessions.rootSessionId,
          questionIds: sessions.questionIds,
          startedAt: sessions.startedAt,
          completedAt: sessions.completedAt,
          resultSummary: sessions.resultSummary,
          setTitle: questionSets.title,
          type: questionSets.type,
        })
        .from(sessions)
        .innerJoin(questionSets, eq(sessions.questionSetId, questionSets.id))
        .where(where)
        // Newest first; id as a tiebreaker so pages never overlap or skip rows.
        .orderBy(desc(sessions.startedAt), desc(sessions.id))
        .limit(PAGE_SIZE)
        .offset(offset),
  );

  // Retry depth ("First retry", ...) needs each row's whole journey, which may
  // reach onto other pages — so read just those journeys' links, not every
  // session the student has ever had.
  const roots = [...new Set(rows.flatMap((row) => (row.rootSessionId ? [row.rootSessionId] : [])))];
  const links =
    roots.length > 0
      ? await db
          .select({ id: sessions.id, retryOfSessionId: sessions.retryOfSessionId })
          .from(sessions)
          .where(and(eq(sessions.userId, params.userId), inArray(sessions.rootSessionId, roots)))
      : [];
  const depths = retryDepths(links);

  return {
    total,
    pagination,
    items: rows.flatMap((row) => {
      if (!row.setId || row.status === "abandoned") return [];
      const depth = depths.get(row.id) ?? 0;
      return [
        {
          sessionId: row.id,
          setId: row.setId,
          setTitle: row.setTitle,
          type: row.type,
          status: row.status,
          depth,
          label: retryLabel(depth),
          isRetry: row.sessionType === "INCORRECT_PRACTICE",
          questionCount: row.questionIds?.length ?? 0,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          summary: parseStoredSummary(row.resultSummary),
        },
      ];
    }),
  };
}
