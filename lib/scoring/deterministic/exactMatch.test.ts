import { describe, expect, it } from "vitest";

import { scoreExactMatch } from "./exactMatch";

describe("scoreExactMatch", () => {
  it("scores an identical response as correct", () => {
    const result = scoreExactMatch({ correctAnswer: "b", response: "b" });
    expect(result).toEqual({ score: 1, maxScore: 1, correct: true });
  });

  it("scores a different response as incorrect", () => {
    const result = scoreExactMatch({ correctAnswer: "b", response: "c" });
    expect(result).toEqual({ score: 0, maxScore: 1, correct: false });
  });

  it("is case-insensitive", () => {
    expect(
      scoreExactMatch({ correctAnswer: "Minutes", response: "minutes" })
        .correct,
    ).toBe(true);
  });

  it("ignores surrounding punctuation", () => {
    expect(
      scoreExactMatch({ correctAnswer: "minutes", response: "minutes." })
        .correct,
    ).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(
      scoreExactMatch({ correctAnswer: "minutes", response: "  minutes  " })
        .correct,
    ).toBe(true);
  });

  it("never returns a negative or fractional score", () => {
    const result = scoreExactMatch({ correctAnswer: "x", response: "y" });
    expect(result.score).toBe(0);
  });
});
