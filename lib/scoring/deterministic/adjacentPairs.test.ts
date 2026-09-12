import { describe, expect, it } from "vitest";

import { scoreAdjacentPairs } from "./adjacentPairs";

const FOUR = ["A", "B", "C", "D"];

describe("scoreAdjacentPairs", () => {
  it("fully correct ordering scores the maximum (N-1)", () => {
    const result = scoreAdjacentPairs({
      correctOrder: FOUR,
      studentOrder: [...FOUR],
    });
    expect(result).toEqual({ score: 3, maxScore: 3 });
  });

  /**
   * The rule is directional, not just "placed next to each other." A-B is
   * not the same credit as B-A. Correct pairs are A-B, B-C, C-D; none of
   * them appear as an in-order "immediately followed by" pair in A-C-B-D
   * (A is followed by C, not B; C is followed by B, the right neighbours
   * but the wrong direction; B is followed by D, not C).
   */
  it("a single swap (A-C-B-D against A-B-C-D) scores 0", () => {
    const result = scoreAdjacentPairs({
      correctOrder: FOUR,
      studentOrder: ["A", "C", "B", "D"],
    });
    expect(result).toEqual({ score: 0, maxScore: 3 });
  });

  /**
   * A full reversal scores exactly 0, not "low" — every correct pair
   * survives only in reverse direction (B-A instead of A-B, and so on),
   * and reverse direction never counts. This holds for any N.
   */
  it("a full reversal (D-C-B-A against A-B-C-D) scores 0", () => {
    const result = scoreAdjacentPairs({
      correctOrder: FOUR,
      studentOrder: [...FOUR].reverse(),
    });
    expect(result).toEqual({ score: 0, maxScore: 3 });
  });

  it("the 2-item minimum: correct order scores the sole possible point", () => {
    const result = scoreAdjacentPairs({
      correctOrder: ["A", "B"],
      studentOrder: ["A", "B"],
    });
    expect(result).toEqual({ score: 1, maxScore: 1 });
  });

  it("the 2-item minimum: swapped order scores 0", () => {
    const result = scoreAdjacentPairs({
      correctOrder: ["A", "B"],
      studentOrder: ["B", "A"],
    });
    expect(result).toEqual({ score: 0, maxScore: 1 });
  });

  /**
   * Proves partial credit is actually reachable under this rule (not just
   * "full marks or zero"): A, B and C are rotated so none of A-B, B-C, C-D
   * survive in order, but D staying right after C preserves exactly one
   * correct pair.
   */
  it("exactly one correct pair surviving among broken ones scores 1", () => {
    const result = scoreAdjacentPairs({
      correctOrder: ["A", "B", "C", "D", "E"],
      studentOrder: ["C", "B", "A", "D", "E"],
    });
    expect(result).toEqual({ score: 1, maxScore: 4 });
  });

  it("N boxes -> max N-1, for several N, regardless of student input", () => {
    for (const n of [2, 3, 4, 5, 10]) {
      const correctOrder = Array.from({ length: n }, (_, i) => i);
      const result = scoreAdjacentPairs({
        correctOrder,
        studentOrder: correctOrder,
      });
      expect(result.maxScore).toBe(n - 1);
    }
  });

  it("a completely unrelated student ordering scores 0, not negative", () => {
    const result = scoreAdjacentPairs({
      correctOrder: [1, 2, 3, 4],
      studentOrder: [9, 8, 7, 6],
    });
    expect(result.score).toBe(0);
  });
});
