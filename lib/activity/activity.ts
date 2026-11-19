/**
 * Pure rules for tracking and reporting how long students actively use the
 * app. No database or browser access here, so every rule is unit-tested.
 *
 * HOW TIME IS COUNTED
 *   - The browser sends a heartbeat every HEARTBEAT_INTERVAL_S seconds, but
 *     only while the tab is visible AND the student has interacted (mouse,
 *     keyboard, touch, scroll) within IDLE_THRESHOLD_S. A hidden tab, a closed
 *     tab or a student who walked away sends nothing.
 *   - The SERVER credits, for each heartbeat, the time since that student's
 *     previous heartbeat — if that gap is at most MAX_CREDIT_S. A longer gap
 *     means they were away (or the browser died), so nothing is credited for
 *     it. Because credit follows the clock for the student as a whole, two open
 *     tabs cover the same minute once, a refresh or page change continues
 *     seamlessly (the next heartbeat is seconds later), and spamming
 *     heartbeats cannot add more time than has actually passed.
 *   - Time is bucketed into days in ACTIVITY_TIME_ZONE.
 *
 * Known limits (stated, not hidden): up to IDLE_THRESHOLD_S of idle time at
 * the end of each active stretch is counted (the student was still "active"
 * by the threshold); a student reading without touching the page for longer
 * than the threshold stops being counted until they interact again.
 */

export const HEARTBEAT_INTERVAL_S = 60;
/** One heartbeat may credit at most this much; a longer gap credits nothing. */
export const MAX_CREDIT_S = 150;
/** No interaction for this long = idle: heartbeats stop. */
export const IDLE_THRESHOLD_S = 180;
/** Days (today, yesterday, ...) are calendar days in this zone. */
export const ACTIVITY_TIME_ZONE = "America/Toronto";

/** What a student was doing; each heartbeat is filed under one. */
export const ACTIVITY_AREAS = ["test", "practice", "review", "other"] as const;
export type ActivityArea = (typeof ACTIVITY_AREAS)[number];

export const AREA_LABELS: Record<ActivityArea, string> = {
  test: "Test",
  practice: "Practice",
  review: "Results & progress",
  other: "Dashboard & other",
};

/**
 * Seconds to credit for a heartbeat arriving at `now`, given the previous
 * heartbeat time (null if there was none). Zero when there is no previous
 * heartbeat, when the clock went backwards, or when the gap is longer than
 * MAX_CREDIT_S (the student was away).
 */
export function creditSeconds(previous: Date | null, now: Date): number {
  if (!previous) return 0;
  const gap = Math.floor((now.getTime() - previous.getTime()) / 1000);
  if (!Number.isFinite(gap) || gap <= 0 || gap > MAX_CREDIT_S) return 0;
  return gap;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MOCK = /^\/mock(?:\/|$)/i;
const LEARN = new RegExp(`^/practice/[A-Z_]+/learn(?:/|$)`, "i");
const TEST = new RegExp(`^/practice/[A-Z_]+/${UUID}(?:/session/${UUID})?/?$`, "i");
const REVIEW = /^\/practice\/(?:history|[A-Z_]+\/(?:progress|tests|[0-9a-f-]{36}\/results))/i;

/** Which activity a page counts as. Unknown paths are "other" — never an error. */
export function areaFromPath(path: string): ActivityArea {
  const clean = path.split("?")[0]?.split("#")[0] ?? "";
  if (MOCK.test(clean)) return "test";
  if (LEARN.test(clean)) return "practice";
  if (TEST.test(clean)) return "test";
  if (REVIEW.test(clean)) return "review";
  return "other";
}

/** Calendar day (YYYY-MM-DD) of an instant in the activity time zone. */
export function dayInZone(at: Date, timeZone: string = ACTIVITY_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `day` (YYYY-MM-DD) moved by `delta` calendar days. */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
  return date.toISOString().slice(0, 10);
}

/** True for a real YYYY-MM-DD date (rejects "2026-02-31" and junk). */
export function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

export interface DayRow {
  day: string;
  seconds: number;
  byArea: Partial<Record<ActivityArea, number>>;
}

/** Totals for "today, yesterday, last 7 days, last 30 days" as of `today`. The 7 and 30 day windows include today. */
export function rollingTotals(rows: readonly Pick<DayRow, "day" | "seconds">[], today: string) {
  const yesterday = addDays(today, -1);
  const from7 = addDays(today, -6);
  const from30 = addDays(today, -29);
  const total = { today: 0, yesterday: 0, last7: 0, last30: 0 };
  for (const row of rows) {
    if (row.day === today) total.today += row.seconds;
    if (row.day === yesterday) total.yesterday += row.seconds;
    if (row.day >= from7 && row.day <= today) total.last7 += row.seconds;
    if (row.day >= from30 && row.day <= today) total.last30 += row.seconds;
  }
  return total;
}

export interface ActivitySummary {
  totalSeconds: number;
  /** Days in the period with any time. */
  activeDays: number;
  /** Average over ACTIVE days only (days with no activity aren't averaged in). */
  averageSecondsPerActiveDay: number;
  /** Busiest days, most time first, ties broken by the later date. */
  mostActive: DayRow[];
  /** Seconds per area across the period. */
  byArea: Record<ActivityArea, number>;
}

export function summarizeActivity(rows: readonly DayRow[], topN = 5): ActivitySummary {
  const active = rows.filter((row) => row.seconds > 0);
  const byArea = { test: 0, practice: 0, review: 0, other: 0 } as Record<ActivityArea, number>;
  let total = 0;
  for (const row of active) {
    total += row.seconds;
    for (const area of ACTIVITY_AREAS) byArea[area] += row.byArea[area] ?? 0;
  }
  return {
    totalSeconds: total,
    activeDays: active.length,
    averageSecondsPerActiveDay: active.length > 0 ? Math.round(total / active.length) : 0,
    mostActive: [...active].sort((a, b) => b.seconds - a.seconds || (a.day < b.day ? 1 : -1)).slice(0, topN),
    byArea,
  };
}

/** "2 hours 15 minutes", "45 minutes", "1 minute", "Less than a minute", "0 minutes". */
export function formatSpent(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (s === 0) return "0 minutes";
  const minutes = Math.round(s / 60);
  if (minutes === 0) return "Less than a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h > 0 ? `${h} ${h === 1 ? "hour" : "hours"}` : "";
  const mins = m > 0 ? `${m} ${m === 1 ? "minute" : "minutes"}` : "";
  return [hours, mins].filter(Boolean).join(" ");
}

/** The areas a day included, biggest first, e.g. "Practice 1 hour 20 minutes · Test 40 minutes". */
export function describeAreas(byArea: Partial<Record<ActivityArea, number>>): string {
  return ACTIVITY_AREAS.filter((a) => (byArea[a] ?? 0) > 0)
    .sort((a, b) => (byArea[b] ?? 0) - (byArea[a] ?? 0))
    .map((a) => `${AREA_LABELS[a]} ${formatSpent(byArea[a] ?? 0)}`)
    .join(" · ");
}
