import { describe, expect, it } from "vitest";

import { scoreAdjacentPairs } from "@/lib/scoring/deterministic/adjacentPairs";

import { computeReorderPairBreakdown } from "./reorderPairBreakdown";

/**
 * lib/scoring/deterministic/adjacentPairs.ts (scoring) and
 * lib/practice/reorderPairBreakdown.ts (display) are two INDEPENDENT
 * implementations of the same "correct adjacent pair" rule — the latter was
 * deliberately written fresh rather than importing from the former (its
 * pair-key builder is a private, unexported helper), specifically so the
 * per-pair breakdown shown to a student is genuinely computed, not just
 * assumed consistent with what they were actually scored on.
 *
 * That independence is exactly what makes them able to silently drift apart
 * — this test is the guarantee that they never do. For every fixture, the
 * COUNT of breakdown entries marked `correct` must equal
 * scoreAdjacentPairs()'s `score` for the identical correctOrder/studentOrder
 * input. If this ever fails, it's a real scoring/display mismatch to fix,
 * not a test to loosen.
 */
describe("adjacentPairs.ts vs reorderPairBreakdown.ts: cross-check", () => {
  const fixtures: {
    name: string;
    correctOrder: string[];
    studentOrder: string[];
  }[] = [
    {
      name: "fully correct order",
      correctOrder: ["A", "B", "C", "D"],
      studentOrder: ["A", "B", "C", "D"],
    },
    {
      name: "fully reversed order",
      correctOrder: ["A", "B", "C", "D"],
      studentOrder: ["D", "C", "B", "A"],
    },
    {
      name: "single swap (A-C-B-D against A-B-C-D)",
      correctOrder: ["A", "B", "C", "D"],
      studentOrder: ["A", "C", "B", "D"],
    },
    {
      name: "exactly one surviving pair among broken ones",
      correctOrder: ["A", "B", "C", "D", "E"],
      studentOrder: ["C", "B", "A", "D", "E"],
    },
    {
      name: "2-item case, correct order",
      correctOrder: ["A", "B"],
      studentOrder: ["A", "B"],
    },
    {
      name: "2-item case, swapped",
      correctOrder: ["A", "B"],
      studentOrder: ["B", "A"],
    },
    {
      name: "completely unrelated student ordering",
      correctOrder: ["1", "2", "3", "4"],
      studentOrder: ["9", "8", "7", "6"],
    },
    {
      name: "real sentence-length strings, partially correct",
      correctOrder: [
        "The council approved the budget in March.",
        "Construction began the following summer.",
        "The project was completed a year later.",
      ],
      studentOrder: [
        "The council approved the budget in March.",
        "The project was completed a year later.",
        "Construction began the following summer.",
      ],
    },
  ];

  it.each(fixtures)(
    "$name: breakdown's correct-pair count matches scoreAdjacentPairs' score",
    ({ correctOrder, studentOrder }) => {
      const scoringResult = scoreAdjacentPairs({ correctOrder, studentOrder });
      const breakdown = computeReorderPairBreakdown(correctOrder, studentOrder);
      const breakdownCorrectCount = breakdown.filter(
        (entry) => entry.correct,
      ).length;

      expect(breakdownCorrectCount).toBe(scoringResult.score);
      // Same invariant from the other direction: the breakdown always has
      // exactly maxScore entries (N-1), one per correct-order adjacent pair.
      expect(breakdown).toHaveLength(scoringResult.maxScore);
    },
  );

  it("holds across a spread of N and random-ish student orderings, not just the hand-picked fixtures", () => {
    const bases = [
      ["A", "B", "C", "D", "E", "F"],
      ["1", "2", "3", "4", "5"],
      ["x", "y", "z"],
    ];

    for (const base of bases) {
      const studentOrderingsForThisBase = [
        [...base], // identity
        [...base].reverse(),
        [...base].sort(() => 0.5 - Math.random()),
      ];

      for (const studentOrder of studentOrderingsForThisBase) {
        const scoringResult = scoreAdjacentPairs({
          correctOrder: base,
          studentOrder,
        });
        const breakdown = computeReorderPairBreakdown(base, studentOrder);
        const breakdownCorrectCount = breakdown.filter(
          (entry) => entry.correct,
        ).length;
        expect(breakdownCorrectCount).toBe(scoringResult.score);
      }
    }
  });
});
