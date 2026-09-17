/**
 * Throttle for `active_sessions.last_seen_at` — session 7A's instruction:
 * "don't write to the database on every single request." Pure so the
 * 5-minute threshold is exhaustively testable without a live clock or DB.
 */

export const LAST_SEEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** True if `lastSeenAt` is missing, or strictly more than the refresh interval old. */
export function shouldRefreshLastSeen(
  lastSeenAt: Date | null,
  now: Date,
): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() > LAST_SEEN_REFRESH_INTERVAL_MS;
}
