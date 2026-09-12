import { describe, expect, it } from "vitest";

import { scoreNegativeMarking } from "./negativeMarking";

describe("scoreNegativeMarking", () => {
  it("all correct: full credit, no penalty", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "b"],
      studentSelections: ["a", "b"],
    });
    expect(result).toEqual({
      score: 2,
      maxScore: 2,
      correctCount: 2,
      incorrectCount: 0,
    });
  });

  it("all incorrect: floors at 0, never negative", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "b"],
      studentSelections: ["c", "d"],
    });
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(2);
    expect(result.score).toBe(0);
  });

  it("far more incorrect selections than possible correct ones still floors at 0", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a"],
      studentSelections: ["b", "c", "d", "e", "f", "g"],
    });
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(6);
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("mixed: correct selections net against incorrect ones", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "b", "c"],
      studentSelections: ["a", "b", "x"], // 2 correct, 1 incorrect
    });
    expect(result).toEqual({
      score: 1,
      maxScore: 3,
      correctCount: 2,
      incorrectCount: 1,
    });
  });

  it("mixed, net negative: still floors at 0 rather than reporting -1", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "b", "c"],
      studentSelections: ["a", "x", "y"], // 1 correct, 2 incorrect -> raw -1
    });
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(2);
    expect(result.score).toBe(0);
  });

  it("zero selections: zero score, no penalty for abstaining", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "b"],
      studentSelections: [],
    });
    expect(result).toEqual({
      score: 0,
      maxScore: 2,
      correctCount: 0,
      incorrectCount: 0,
    });
  });

  it("de-duplicates repeated selections in both directions", () => {
    const result = scoreNegativeMarking({
      correctSelections: ["a", "a", "b"],
      studentSelections: ["a", "a", "a"],
    });
    expect(result.maxScore).toBe(2); // {a, b}
    expect(result.correctCount).toBe(1); // {a} selected once, not three times
    expect(result.incorrectCount).toBe(0);
    expect(result.score).toBe(1);
  });

  it("works with numeric selections (Highlight Incorrect Words' word indices)", () => {
    const result = scoreNegativeMarking({
      correctSelections: [2, 5, 9],
      studentSelections: [2, 9, 100],
    });
    expect(result).toEqual({
      score: 1, // 2 correct, 1 incorrect
      maxScore: 3,
      correctCount: 2,
      incorrectCount: 1,
    });
  });
});
