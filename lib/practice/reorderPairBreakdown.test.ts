import { describe, expect, it } from "vitest";

import { computeReorderPairBreakdown } from "./reorderPairBreakdown";

const FOUR = ["A", "B", "C", "D"];

describe("computeReorderPairBreakdown", () => {
  it("fully correct ordering marks every pair correct", () => {
    const breakdown = computeReorderPairBreakdown(FOUR, [...FOUR]);
    expect(breakdown).toEqual([
      { first: "A", second: "B", correct: true },
      { first: "B", second: "C", correct: true },
      { first: "C", second: "D", correct: true },
    ]);
  });

  /**
   * Same scenario as adjacentPairs.test.ts's "single swap" case (scores 0)
   * — here every pair should individually show as broken, not just the
   * aggregate score being 0.
   */
  it("a single swap (A-C-B-D against A-B-C-D) marks every pair broken", () => {
    const breakdown = computeReorderPairBreakdown(FOUR, ["A", "C", "B", "D"]);
    expect(breakdown).toEqual([
      { first: "A", second: "B", correct: false },
      { first: "B", second: "C", correct: false },
      { first: "C", second: "D", correct: false },
    ]);
  });

  it("a full reversal marks every pair broken, not just scores 0", () => {
    const breakdown = computeReorderPairBreakdown(FOUR, [...FOUR].reverse());
    expect(breakdown.every((entry) => !entry.correct)).toBe(true);
    expect(breakdown).toHaveLength(3);
  });

  it("being adjacent in the REVERSE direction still counts as broken", () => {
    // B immediately followed by A is not the same as A immediately
    // followed by B — direction matters for the breakdown too.
    const breakdown = computeReorderPairBreakdown(["A", "B"], ["B", "A"]);
    expect(breakdown).toEqual([{ first: "A", second: "B", correct: false }]);
  });

  /**
   * Same scenario as adjacentPairs.test.ts's "exactly one correct pair"
   * case: A, B, C rotated so only C-D survives.
   */
  it("marks exactly the one surviving pair correct among broken ones", () => {
    const breakdown = computeReorderPairBreakdown(
      ["A", "B", "C", "D", "E"],
      ["C", "B", "A", "D", "E"],
    );
    expect(breakdown).toEqual([
      { first: "A", second: "B", correct: false },
      { first: "B", second: "C", correct: false },
      { first: "C", second: "D", correct: false },
      { first: "D", second: "E", correct: true },
    ]);
  });

  it("produces exactly N-1 entries, in the CORRECT order's own sequence", () => {
    const breakdown = computeReorderPairBreakdown(
      ["A", "B", "C", "D", "E"],
      ["E", "D", "C", "B", "A"],
    );
    expect(breakdown.map((entry) => entry.first)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(breakdown.map((entry) => entry.second)).toEqual([
      "B",
      "C",
      "D",
      "E",
    ]);
  });

  it("the 2-item minimum produces exactly one entry", () => {
    const breakdown = computeReorderPairBreakdown(["A", "B"], ["A", "B"]);
    expect(breakdown).toEqual([{ first: "A", second: "B", correct: true }]);
  });

  it("a completely unrelated student ordering marks every pair broken", () => {
    const breakdown = computeReorderPairBreakdown(
      ["1", "2", "3", "4"],
      ["9", "8", "7", "6"],
    );
    expect(breakdown.every((entry) => !entry.correct)).toBe(true);
  });

  it("works with real sentence-length strings, not just single letters", () => {
    const correctOrder = [
      "The council approved the budget in March.",
      "Construction began the following summer.",
      "The project was completed a year later.",
    ];
    const studentOrder = [correctOrder[0], correctOrder[2], correctOrder[1]].map(
      (s) => s as string,
    );
    const breakdown = computeReorderPairBreakdown(correctOrder, studentOrder);
    expect(breakdown).toEqual([
      { first: correctOrder[0], second: correctOrder[1], correct: false },
      { first: correctOrder[1], second: correctOrder[2], correct: false },
    ]);
  });
});
