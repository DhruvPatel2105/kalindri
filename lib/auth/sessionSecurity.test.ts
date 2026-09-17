import { describe, expect, it } from "vitest";

import {
  isGeoJump,
  shouldFlagForLoginFrequency,
  shouldFlagForTakeoverFrequency,
  type TimestampedEvent,
} from "./sessionSecurity";

const NOW = new Date("2026-01-01T12:00:00.000Z");

function eventsAt(...hoursAgo: number[]): TimestampedEvent[] {
  return hoursAgo.map((h) => ({
    createdAt: new Date(NOW.getTime() - h * 60 * 60 * 1000),
  }));
}

describe("shouldFlagForTakeoverFrequency (default: 3 in 24h)", () => {
  it("flags at exactly the threshold", () => {
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1, 2), NOW)).toBe(true);
  });

  it("does not flag one under the threshold", () => {
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1), NOW)).toBe(false);
  });

  it("flags one over the threshold", () => {
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1, 2, 3), NOW)).toBe(
      true,
    );
  });

  it("does not count events outside the window", () => {
    // 25h ago is outside the 24h window — only 2 of these 3 count.
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1, 25), NOW)).toBe(
      false,
    );
  });

  it("does not flag an empty event list", () => {
    expect(shouldFlagForTakeoverFrequency([], NOW)).toBe(false);
  });

  it("counts an event exactly at the window boundary (inclusive)", () => {
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1, 24), NOW)).toBe(
      true,
    );
  });

  it("does not count a future event", () => {
    expect(shouldFlagForTakeoverFrequency(eventsAt(0, 1, -1), NOW)).toBe(
      false,
    );
  });

  it("respects a custom thresholdCount and windowMs", () => {
    expect(
      shouldFlagForTakeoverFrequency(eventsAt(0, 1), NOW, 2, 6 * 60 * 60 * 1000),
    ).toBe(true);
    expect(
      shouldFlagForTakeoverFrequency(eventsAt(0, 7), NOW, 2, 6 * 60 * 60 * 1000),
    ).toBe(false);
  });
});

describe("shouldFlagForLoginFrequency (caller-supplied threshold/window)", () => {
  const threshold = 5;
  const windowMs = 60 * 60 * 1000; // 1 hour, in minutes-scale events below

  function minutesAgo(...mins: number[]): TimestampedEvent[] {
    return mins.map((m) => ({
      createdAt: new Date(NOW.getTime() - m * 60 * 1000),
    }));
  }

  it("flags at exactly the threshold", () => {
    expect(
      shouldFlagForLoginFrequency(
        minutesAgo(0, 10, 20, 30, 40),
        NOW,
        threshold,
        windowMs,
      ),
    ).toBe(true);
  });

  it("does not flag one under the threshold", () => {
    expect(
      shouldFlagForLoginFrequency(
        minutesAgo(0, 10, 20, 30),
        NOW,
        threshold,
        windowMs,
      ),
    ).toBe(false);
  });

  it("flags one over the threshold", () => {
    expect(
      shouldFlagForLoginFrequency(
        minutesAgo(0, 10, 20, 30, 40, 50),
        NOW,
        threshold,
        windowMs,
      ),
    ).toBe(true);
  });

  it("does not count events outside the window", () => {
    // 61 minutes ago is outside the 60-minute window.
    expect(
      shouldFlagForLoginFrequency(
        minutesAgo(0, 10, 20, 30, 61),
        NOW,
        threshold,
        windowMs,
      ),
    ).toBe(false);
  });

  it("does not flag an empty event list", () => {
    expect(shouldFlagForLoginFrequency([], NOW, threshold, windowMs)).toBe(
      false,
    );
  });
});

describe("isGeoJump", () => {
  it("is false when both countries are null", () => {
    expect(
      isGeoJump({ country: null, at: NOW }, { country: null, at: NOW }),
    ).toBe(false);
  });

  it("is false when only the previous country is null", () => {
    expect(
      isGeoJump({ country: null, at: NOW }, { country: "CA", at: NOW }),
    ).toBe(false);
  });

  it("is false when only the current country is null", () => {
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: null, at: NOW }),
    ).toBe(false);
  });

  it("is false for the same country", () => {
    const later = new Date(NOW.getTime() + 30 * 60 * 1000);
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: "CA", at: later }),
    ).toBe(false);
  });

  it("is true for a different country within the window", () => {
    const later = new Date(NOW.getTime() + 60 * 60 * 1000); // 1h, default window 3h
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: "FR", at: later }),
    ).toBe(true);
  });

  it("is false for a different country outside the window", () => {
    const later = new Date(NOW.getTime() + 4 * 60 * 60 * 1000); // 4h, default window 3h
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: "FR", at: later }),
    ).toBe(false);
  });

  it("is false exactly at the window boundary (strictly under, not at)", () => {
    const later = new Date(NOW.getTime() + 3 * 60 * 60 * 1000); // exactly 3h
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: "FR", at: later }),
    ).toBe(false);
  });

  it("respects a custom maxPlausibleWindowMs", () => {
    const later = new Date(NOW.getTime() + 10 * 60 * 1000); // 10 minutes
    expect(
      isGeoJump(
        { country: "CA", at: NOW },
        { country: "FR", at: later },
        5 * 60 * 1000, // 5 minutes
      ),
    ).toBe(false);
    expect(
      isGeoJump(
        { country: "CA", at: NOW },
        { country: "FR", at: later },
        15 * 60 * 1000, // 15 minutes
      ),
    ).toBe(true);
  });

  it("handles the previous point being AFTER the current point (absolute difference)", () => {
    const earlier = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(
      isGeoJump({ country: "CA", at: NOW }, { country: "FR", at: earlier }),
    ).toBe(true);
  });
});
