import { describe, expect, it } from "vitest";

import { allCorrect, barSegments, retryCount, retryDepths, retryLabel } from "./retry";
import { summarizeTest, type TestSummary } from "./testResults";

const q = (score: number | null, max = 2, answered = true) => ({ answered, score, maxScore: max });

function summary(parts: { c?: number; p?: number; i?: number; u?: number }): TestSummary {
  return summarizeTest([
    ...Array.from({ length: parts.c ?? 0 }, () => q(2)),
    ...Array.from({ length: parts.p ?? 0 }, () => q(1)),
    ...Array.from({ length: parts.i ?? 0 }, () => q(0)),
    ...Array.from({ length: parts.u ?? 0 }, () => q(null, 2, false)),
  ]);
}

describe("retryLabel", () => {
  it("names the original and each retry", () => {
    expect(retryLabel(0)).toBe("Original test");
    expect(retryLabel(1)).toBe("First retry");
    expect(retryLabel(2)).toBe("Second retry");
    expect(retryLabel(10)).toBe("Tenth retry");
  });

  it("falls back to a number past ten, and to Original for junk", () => {
    expect(retryLabel(11)).toBe("Retry 11");
    expect(retryLabel(-1)).toBe("Original test");
    expect(retryLabel(1.5)).toBe("Original test");
  });
});

describe("retryCount", () => {
  it("is everything that wasn't full marks", () => {
    expect(retryCount(summary({ c: 10, p: 1, i: 3, u: 1 }))).toBe(5);
  });

  it("is zero when everything is right", () => {
    expect(retryCount(summary({ c: 4 }))).toBe(0);
  });
});

describe("allCorrect", () => {
  it("only when every question had full marks", () => {
    expect(allCorrect(summary({ c: 2 }))).toBe(true);
    expect(allCorrect(summary({ c: 2, p: 1 }))).toBe(false);
    expect(allCorrect(summary({ c: 2, u: 1 }))).toBe(false);
  });

  it("is false for an empty test and while answers await marks", () => {
    expect(allCorrect(summary({}))).toBe(false);
    expect(allCorrect(summarizeTest([q(2), q(null)]))).toBe(false);
  });
});

describe("barSegments", () => {
  it("the example round: 10 correct, 5 incorrect", () => {
    const segments = barSegments(summary({ c: 10, i: 5 }));
    expect(segments.map((s) => [s.kind, s.count])).toEqual([
      ["correct", 10],
      ["incorrect", 5],
    ]);
    expect(segments[0]?.percent).toBeCloseTo(66.67, 1);
  });

  it("always adds up to 100%", () => {
    const total = barSegments(summary({ c: 3, p: 2, i: 1, u: 4 })).reduce(
      (sum, s) => sum + s.percent,
      0,
    );
    expect(total).toBeCloseTo(100, 5);
  });

  it("leaves empty segments out, and an empty round has none", () => {
    expect(barSegments(summary({ c: 2 })).map((s) => s.kind)).toEqual(["correct"]);
    expect(barSegments(summary({}))).toEqual([]);
  });
});

describe("retryDepths", () => {
  it("0 for originals, +1 per retry", () => {
    const depths = retryDepths([
      { id: "a", retryOfSessionId: null },
      { id: "b", retryOfSessionId: "a" },
      { id: "c", retryOfSessionId: "b" },
      { id: "x", retryOfSessionId: null },
    ]);
    expect([...depths]).toEqual([["a", 0], ["b", 1], ["c", 2], ["x", 0]]);
  });

  it("doesn't depend on row order", () => {
    const depths = retryDepths([
      { id: "c", retryOfSessionId: "b" },
      { id: "b", retryOfSessionId: "a" },
      { id: "a", retryOfSessionId: null },
    ]);
    expect(depths.get("c")).toBe(2);
  });

  it("counts a missing parent as one step up", () => {
    expect(retryDepths([{ id: "b", retryOfSessionId: "gone" }]).get("b")).toBe(1);
  });

  it("can't loop on a cycle", () => {
    const depths = retryDepths([
      { id: "a", retryOfSessionId: "b" },
      { id: "b", retryOfSessionId: "a" },
    ]);
    expect(depths.get("a")).toBeLessThanOrEqual(2);
  });
});
