import { describe, expect, it } from "vitest";

import { computeMastery, type MasteryAttempt } from "./mastery";

const at = (day: number) => new Date(2026, 0, day);
const attempt = (
  questionId: string,
  isCorrect: boolean | null,
  day: number,
  type: MasteryAttempt["type"] = "FIB_RW",
): MasteryAttempt => ({ questionId, type, isCorrect, submittedAt: at(day) });

describe("computeMastery", () => {
  it("a question's LATEST answer decides: wrong then right is mastered", () => {
    const { overall } = computeMastery([attempt("q1", false, 1), attempt("q1", true, 5)]);
    expect(overall).toEqual({ unique: 1, mastered: 1, percent: 100 });
  });

  it("right then wrong is not mastered", () => {
    expect(computeMastery([attempt("q1", true, 1), attempt("q1", false, 5)]).overall.mastered).toBe(0);
  });

  it("doesn't depend on row order", () => {
    const rows = [attempt("q1", true, 5), attempt("q1", false, 1)];
    expect(computeMastery(rows).overall.mastered).toBe(1);
    expect(computeMastery([...rows].reverse()).overall.mastered).toBe(1);
  });

  it("counts each unique question once, however many times it was answered", () => {
    const { overall } = computeMastery([
      attempt("q1", false, 1),
      attempt("q1", false, 2),
      attempt("q1", true, 3),
      attempt("q2", false, 1),
      attempt("q3", true, 1),
    ]);
    expect(overall).toEqual({ unique: 3, mastered: 2, percent: 67 });
  });

  it("an answer still awaiting its mark doesn't override an earlier result", () => {
    expect(computeMastery([attempt("q1", true, 1), attempt("q1", null, 9)]).overall.mastered).toBe(1);
  });

  it("a question with only unmarked answers isn't counted at all", () => {
    expect(computeMastery([attempt("q1", null, 1)]).overall).toEqual({ unique: 0, mastered: 0, percent: null });
  });

  it("is reported per type and the types add up to the overall", () => {
    const { overall, byType } = computeMastery([
      attempt("q1", true, 1, "FIB_RW"),
      attempt("q2", false, 1, "FIB_RW"),
      attempt("q3", true, 1, "REORDER_PARAGRAPH"),
    ]);
    expect(byType.get("FIB_RW")).toEqual({ unique: 2, mastered: 1, percent: 50 });
    expect(byType.get("REORDER_PARAGRAPH")).toEqual({ unique: 1, mastered: 1, percent: 100 });
    expect([...byType.values()].reduce((n, m) => n + m.unique, 0)).toBe(overall.unique);
  });

  it("nothing answered: no percentage, no NaN", () => {
    const { overall, byType } = computeMastery([]);
    expect(overall).toEqual({ unique: 0, mastered: 0, percent: null });
    expect(byType.size).toBe(0);
  });
});
