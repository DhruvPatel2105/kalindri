import "server-only";

/**
 * Server-side loaders that turn saved sessions into dashboard input. A
 * finished session saved before result summaries were stored (or whose
 * marking was still pending) has none yet; computing it with getTestResults
 * also stores it for next time, so these fill the gaps once.
 */

import { getDb } from "@/lib/db";
import type { QuestionType } from "@/lib/questions/types";

import type { HistoryItem } from "./listHistory";
import { getFinishedSessions } from "./listTypeSessions";
import { getTestResults } from "./testEngine";
import type { FinishedSession } from "./typeStats";

type SessionUser = Parameters<typeof getTestResults>[0];

export async function loadFinishedSessions(
  user: SessionUser,
  type?: QuestionType,
): Promise<(FinishedSession & { type: QuestionType })[]> {
  const rows = await getFinishedSessions(getDb(), { userId: user.id, type });

  const filled = await Promise.all(
    rows.map(async (row) => {
      let summary = row.summary;
      if (!summary) {
        try {
          summary = (await getTestResults(user, row.sessionId)).summary;
        } catch {
          return null;
        }
      }
      return {
        sessionId: row.sessionId,
        type: row.type,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        isRetry: row.isRetry,
        summary,
      };
    }),
  );
  return filled.flatMap((row) => (row ? [row] : []));
}

/** Fills in the result summary of finished history rows that don't have one stored yet. */
export async function fillHistorySummaries(
  user: SessionUser,
  items: HistoryItem[],
): Promise<HistoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.status !== "completed" || item.summary) return item;
      try {
        return { ...item, summary: (await getTestResults(user, item.sessionId)).summary };
      } catch {
        return item;
      }
    }),
  );
}
