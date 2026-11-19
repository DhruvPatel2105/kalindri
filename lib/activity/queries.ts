/**
 * Admin-side reads of user_activity_days. Plain module (db passed in). Every
 * query is scoped to an org; callers have already passed requireAdmin.
 */

import { and, desc, eq, gte, lte, max, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "@/lib/db/schema";
import { userActivityDays } from "@/lib/db/schema";

import { addDays, ACTIVITY_AREAS, type ActivityArea, type DayRow } from "./activity";

type Database = PostgresJsDatabase<typeof schema>;

export interface UserActivityTotals {
  today: number;
  yesterday: number;
  last7: number;
  last30: number;
  lastActiveAt: Date | null;
}

/**
 * Today / yesterday / 7-day / 30-day seconds and the last active time for
 * EVERY user in the org, in one aggregate query (not one query per user).
 */
export async function getActivityOverview(
  db: Database,
  params: { orgId: string; today: string },
): Promise<Map<string, UserActivityTotals>> {
  const { today } = params;
  const sum = (from: string, to: string) =>
    sql<number>`coalesce(sum(${userActivityDays.seconds}) filter (where ${userActivityDays.day} >= ${from} and ${userActivityDays.day} <= ${to}), 0)::int`;

  const rows = await db
    .select({
      userId: userActivityDays.userId,
      today: sum(today, today),
      yesterday: sum(addDays(today, -1), addDays(today, -1)),
      last7: sum(addDays(today, -6), today),
      last30: sum(addDays(today, -29), today),
      lastActiveAt: max(userActivityDays.lastActiveAt),
    })
    .from(userActivityDays)
    .where(eq(userActivityDays.orgId, params.orgId))
    .groupBy(userActivityDays.userId);

  return new Map(
    rows.map((row) => [
      row.userId,
      {
        today: Number(row.today),
        yesterday: Number(row.yesterday),
        last7: Number(row.last7),
        last30: Number(row.last30),
        lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt) : null,
      },
    ]),
  );
}

function toDayRow(row: { day: string; seconds: number; byArea: unknown }): DayRow {
  const raw = (row.byArea && typeof row.byArea === "object" ? row.byArea : {}) as Record<string, unknown>;
  const byArea: Partial<Record<ActivityArea, number>> = {};
  for (const area of ACTIVITY_AREAS) {
    const value = raw[area];
    if (typeof value === "number" && value > 0) byArea[area] = value;
  }
  return { day: row.day, seconds: row.seconds, byArea };
}

/** One user's daily rows in an inclusive date range, newest first. */
export async function getUserDays(
  db: Database,
  params: { orgId: string; userId: string; from: string; to: string },
): Promise<DayRow[]> {
  const rows = await db
    .select({ day: userActivityDays.day, seconds: userActivityDays.seconds, byArea: userActivityDays.byArea })
    .from(userActivityDays)
    .where(
      and(
        eq(userActivityDays.orgId, params.orgId),
        eq(userActivityDays.userId, params.userId),
        gte(userActivityDays.day, params.from),
        lte(userActivityDays.day, params.to),
      ),
    )
    .orderBy(desc(userActivityDays.day));
  return rows.map(toDayRow);
}

/** When the user was last active, and the first day on record (for "all time"). */
export async function getUserActivityBounds(
  db: Database,
  params: { orgId: string; userId: string },
): Promise<{ lastActiveAt: Date | null; firstDay: string | null }> {
  const [row] = await db
    .select({ last: max(userActivityDays.lastActiveAt), first: sql<string | null>`min(${userActivityDays.day})` })
    .from(userActivityDays)
    .where(and(eq(userActivityDays.orgId, params.orgId), eq(userActivityDays.userId, params.userId)));
  return { lastActiveAt: row?.last ? new Date(row.last) : null, firstDay: row?.first ?? null };
}
