import { describe, expect, it } from "vitest";

import {
  LAST_SEEN_REFRESH_INTERVAL_MS,
  shouldRefreshLastSeen,
} from "./sessionFreshness";

describe("shouldRefreshLastSeen", () => {
  const now = new Date("2026-01-01T00:10:00.000Z");

  it("refreshes when there is no prior last_seen_at at all", () => {
    expect(shouldRefreshLastSeen(null, now)).toBe(true);
  });

  it("does not refresh when last seen just now", () => {
    expect(shouldRefreshLastSeen(now, now)).toBe(false);
  });

  it("does not refresh when last seen 4 minutes ago", () => {
    const lastSeenAt = new Date(now.getTime() - 4 * 60 * 1000);
    expect(shouldRefreshLastSeen(lastSeenAt, now)).toBe(false);
  });

  it("does not refresh exactly at the 5-minute boundary", () => {
    const lastSeenAt = new Date(now.getTime() - LAST_SEEN_REFRESH_INTERVAL_MS);
    expect(shouldRefreshLastSeen(lastSeenAt, now)).toBe(false);
  });

  it("refreshes just past the 5-minute boundary", () => {
    const lastSeenAt = new Date(
      now.getTime() - LAST_SEEN_REFRESH_INTERVAL_MS - 1,
    );
    expect(shouldRefreshLastSeen(lastSeenAt, now)).toBe(true);
  });

  it("refreshes when last seen 10 minutes ago", () => {
    const lastSeenAt = new Date(now.getTime() - 10 * 60 * 1000);
    expect(shouldRefreshLastSeen(lastSeenAt, now)).toBe(true);
  });

  it("does not refresh for a last_seen_at that is (clock-skew) in the future", () => {
    const lastSeenAt = new Date(now.getTime() + 60 * 1000);
    expect(shouldRefreshLastSeen(lastSeenAt, now)).toBe(false);
  });
});
