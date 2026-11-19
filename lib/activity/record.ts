import "server-only";

/**
 * Records one heartbeat for the signed-in student. ONE statement, one round
 * trip: it inserts the day's row on the first heartbeat of the day, otherwise
 * adds the credited seconds (see creditSeconds in activity.ts — the same rule,
 * written in SQL so it runs atomically against the stored last heartbeat).
 * Concurrent heartbeats from two tabs serialize on the row, so the second
 * sees the first's timestamp and credits only the small gap: no double
 * counting.
 *
 * It only ever touches the caller's own row, and only if the caller's session
 * is the current, active one (checked inside the statement).
 */

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { ACTIVITY_TIME_ZONE, areaFromPath, MAX_CREDIT_S } from "./activity";

export async function recordHeartbeat(
  userId: string,
  sessionToken: string,
  path: string,
  /** The heartbeat's time; omitted in production (the database's clock is used). Tests pass one. */
  at?: Date,
): Promise<void> {
  const area = areaFromPath(path);
  const ts = at ? sql`${at.toISOString()}::timestamptz` : sql`now()`;
  const gap = sql`EXTRACT(EPOCH FROM (${ts} - user_activity_days.last_active_at))`;
  const credit = sql`CASE WHEN ${gap} >= 1 AND ${gap} <= ${MAX_CREDIT_S} THEN FLOOR(${gap})::int ELSE 0 END`;

  // The SELECT is the whole access check, in the same statement: the user must
  // exist, be active, and this browser's session token must be the CURRENT one
  // (the same rules as requireActiveSession). No match = no row inserted and
  // nothing updated. The organisation comes from the user row, never from the request.
  await getDb().execute(sql`
    INSERT INTO user_activity_days (org_id, user_id, day, seconds, by_area, first_active_at, last_active_at)
    SELECT u.org_id, u.id, (${ts} AT TIME ZONE ${ACTIVITY_TIME_ZONE})::date, 0, '{}'::jsonb, ${ts}, ${ts}
    FROM users u
    JOIN active_sessions s ON s.user_id = u.id
    WHERE u.id = ${userId} AND u.is_active AND s.session_token = ${sessionToken}
    ON CONFLICT (user_id, day) DO UPDATE SET
      seconds = user_activity_days.seconds + ${credit},
      by_area = jsonb_set(
        user_activity_days.by_area, ARRAY[${area}::text],
        to_jsonb(COALESCE((user_activity_days.by_area ->> ${area})::int, 0) + ${credit}), true),
      last_active_at = GREATEST(user_activity_days.last_active_at, ${ts})
  `);
}
