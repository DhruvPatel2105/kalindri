/**
 * Pure sharing-detection heuristics — no database access anywhere in this
 * file. lib/auth/flagging.ts fetches the data and calls these to decide.
 */

export interface TimestampedEvent {
  createdAt: Date;
}

const DEFAULT_TAKEOVER_THRESHOLD_COUNT = 3;
const DEFAULT_TAKEOVER_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GEO_JUMP_WINDOW_MS = 3 * 60 * 60 * 1000;

/** How many `events` fall in the rolling window `(now - windowMs, now]`. */
function countEventsInWindow(
  events: readonly TimestampedEvent[],
  now: Date,
  windowMs: number,
): number {
  const windowStartMs = now.getTime() - windowMs;
  const nowMs = now.getTime();
  return events.filter((event) => {
    const t = event.createdAt.getTime();
    return t >= windowStartMs && t <= nowMs;
  }).length;
}

/**
 * True if `thresholdCount` or more of a user's past 'takeover' events fall
 * inside the rolling window ending at `now`.
 */
export function shouldFlagForTakeoverFrequency(
  events: readonly TimestampedEvent[],
  now: Date,
  thresholdCount = DEFAULT_TAKEOVER_THRESHOLD_COUNT,
  windowMs = DEFAULT_TAKEOVER_WINDOW_MS,
): boolean {
  return countEventsInWindow(events, now, windowMs) >= thresholdCount;
}

/**
 * Same rolling-window pattern as `shouldFlagForTakeoverFrequency`, but for
 * raw login frequency — independent of whether any of those logins were
 * takeovers. No defaults: the caller (lib/auth/flagging.ts) decides what
 * "unusual" means for this signal.
 */
export function shouldFlagForLoginFrequency(
  events: readonly TimestampedEvent[],
  now: Date,
  thresholdCount: number,
  windowMs: number,
): boolean {
  return countEventsInWindow(events, now, windowMs) >= thresholdCount;
}

export interface GeoPoint {
  country: string | null;
  at: Date;
}

/**
 * True only if BOTH countries are non-null, they differ, and the elapsed
 * time between the two points is under `maxPlausibleWindowMs` — i.e. too
 * little time to have plausibly traveled between them. Never throws: a
 * null country (the expected case running locally, where Vercel's geo
 * headers don't exist) just means "nothing to compare", not an error.
 */
export function isGeoJump(
  previous: GeoPoint,
  current: GeoPoint,
  maxPlausibleWindowMs = DEFAULT_GEO_JUMP_WINDOW_MS,
): boolean {
  if (!previous.country || !current.country) return false;
  if (previous.country === current.country) return false;
  const elapsedMs = Math.abs(current.at.getTime() - previous.at.getTime());
  return elapsedMs < maxPlausibleWindowMs;
}
