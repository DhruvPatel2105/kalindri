import { describe, expect, it } from "vitest";

import {
  formatClock,
  MOCK_SEQUENCE,
  mockDeadline,
  missingMockTypes,
  planMockCounts,
  secondsRemaining,
  summarizeMock,
} from "./mock";

const plenty = { FIB_RW: 30, MCM_READING: 10, REORDER_PARAGRAPH: 20, FIB_READING: 60, MCS_READING: 10 };

describe("sequence", () => {
  it("is R&W FIB, MCM, Reorder, Reading FIB, MCS in that order", () => {
    expect(MOCK_SEQUENCE.map((s) => s.type)).toEqual([
      "FIB_RW",
      "MCM_READING",
      "REORDER_PARAGRAPH",
      "FIB_READING",
      "MCS_READING",
    ]);
  });
});

describe("planMockCounts", () => {
  it("stays inside each type's official range", () => {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const counts = planMockCounts(plenty, () => r);
      for (const { type, min, max } of MOCK_SEQUENCE) {
        expect(counts[type]).toBeGreaterThanOrEqual(min);
        expect(counts[type]).toBeLessThanOrEqual(max);
      }
    }
    expect(planMockCounts(plenty, () => 0).FIB_RW).toBe(5);
    expect(planMockCounts(plenty, () => 0.99).FIB_RW).toBe(6);
  });

  it("never asks for more questions than exist", () => {
    const counts = planMockCounts({ ...plenty, MCM_READING: 1, REORDER_PARAGRAPH: 0 }, () => 0.99);
    expect(counts.MCM_READING).toBe(1);
    expect(counts.REORDER_PARAGRAPH).toBe(0);
  });

  it("reports types that have no questions", () => {
    expect(missingMockTypes(plenty)).toEqual([]);
    expect(missingMockTypes({ ...plenty, FIB_READING: 0 })).toEqual(["FIB_READING"]);
  });
});

describe("clock", () => {
  const start = new Date("2026-11-20T15:00:00Z");
  it("counts down to the deadline and stops at zero", () => {
    const deadline = mockDeadline(start, 1800);
    expect(secondsRemaining(deadline, start)).toBe(1800);
    expect(secondsRemaining(deadline, new Date("2026-11-20T15:29:30Z"))).toBe(30);
    expect(secondsRemaining(deadline, new Date("2026-11-20T16:00:00Z"))).toBe(0);
  });
  it("formats minutes and seconds", () => {
    expect(formatClock(1745)).toBe("29:05");
    expect(formatClock(7)).toBe("0:07");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});

describe("summarizeMock", () => {
  const rows = [
    { type: "MCS_READING", answered: true, score: 1, maxScore: 1 },
    { type: "FIB_RW", answered: true, score: 2, maxScore: 4 },
    { type: "FIB_RW", answered: true, score: 4, maxScore: 4 },
    { type: "FIB_RW", answered: false, score: null, maxScore: 4 },
    { type: "MCM_READING", answered: true, score: 0, maxScore: 3 },
  ] as const;

  it("breaks results down by type, in exam order, with raw marks", () => {
    const r = summarizeMock(rows);
    expect(r.perType.map((t) => t.type)).toEqual(["FIB_RW", "MCM_READING", "MCS_READING"]);
    const fib = r.perType[0];
    expect(fib).toMatchObject({ questions: 3, correct: 1, partial: 1, incorrect: 1, score: 6, maxScore: 12, percent: 50 });
    expect(r.perType[1]).toMatchObject({ correct: 0, incorrect: 1, percent: 0 });
    expect(r).toMatchObject({ totalQuestions: 5, correct: 2, partial: 1, incorrect: 2, score: 7, maxScore: 16, percent: 44 });
  });

  it("counts answered-but-unmarked questions separately and handles an empty mock", () => {
    const r = summarizeMock([{ type: "FIB_RW", answered: true, score: null, maxScore: 4 }]);
    expect(r.unmarked).toBe(1);
    expect(r.correct + r.partial + r.incorrect).toBe(0);
    expect(summarizeMock([])).toMatchObject({ totalQuestions: 0, percent: null });
  });
});
