import { describe, expect, it } from "vitest";

import {
  pageNumbers,
  paginate,
  parsePageParam,
  countDifficulties,
  describeSetDifficulty,
  pageOfIndex,
  difficultyBreakdown,
  questionCountLabel,
} from "./questionList";

describe("parsePageParam", () => {
  it("reads a positive integer", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("falls back to 1 for missing, malformed or non-positive values", () => {
    for (const raw of [undefined, "", "abc", "0", "-2", "1.5", "2e3", " 4"]) {
      expect(parsePageParam(raw)).toBe(1);
    }
  });

  it("uses the first value of a repeated param", () => {
    expect(parsePageParam(["2", "5"])).toBe(2);
  });

  it("falls back to 1 for a number too large to be safe", () => {
    expect(parsePageParam("99999999999999999999")).toBe(1);
  });
});

describe("paginate (10 per page)", () => {
  it("computes total pages and offset", () => {
    expect(paginate(63, 1)).toEqual({ page: 1, totalPages: 7, offset: 0 });
    expect(paginate(63, 7)).toEqual({ page: 7, totalPages: 7, offset: 60 });
  });

  it("an exact multiple of the page size has no empty last page", () => {
    expect(paginate(20, 2).totalPages).toBe(2);
    expect(paginate(21, 3).totalPages).toBe(3);
  });

  it("clamps a page past the end to the last page", () => {
    expect(paginate(15, 99)).toEqual({ page: 2, totalPages: 2, offset: 10 });
  });

  it("zero questions is still one (empty) page, never page 0", () => {
    expect(paginate(0, 1)).toEqual({ page: 1, totalPages: 1, offset: 0 });
    expect(paginate(0, 5)).toEqual({ page: 1, totalPages: 1, offset: 0 });
  });
});

describe("pageNumbers", () => {
  it("shows every page when there are few", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("starts at 1 near the beginning", () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(2, 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it("centres on the current page in the middle", () => {
    expect(pageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
  });

  it("ends at the last page near the end", () => {
    expect(pageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageNumbers(9, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it("always includes the current page", () => {
    for (let total = 1; total <= 12; total++) {
      for (let page = 1; page <= total; page++) {
        expect(pageNumbers(page, total)).toContain(page);
      }
    }
  });
});

describe("questionCountLabel", () => {
  it("pluralises", () => {
    expect(questionCountLabel(15)).toBe("15 questions");
    expect(questionCountLabel(0)).toBe("0 questions");
  });

  it("singularises 1", () => {
    expect(questionCountLabel(1)).toBe("1 question");
  });
});

describe("set difficulty", () => {
  it("counts question difficulties, null as unrated", () => {
    expect(countDifficulties(["easy", "easy", "hard", null])).toEqual({ easy: 2, medium: 0, hard: 1, unrated: 1 });
    expect(countDifficulties([])).toEqual({ easy: 0, medium: 0, hard: 0, unrated: 0 });
  });

  it("the set's own rating wins", () => {
    expect(describeSetDifficulty("hard", countDifficulties(["easy", "medium"]))).toEqual({ kind: "single", difficulty: "hard" });
  });

  it("all questions the same difficulty gives that difficulty", () => {
    expect(describeSetDifficulty(null, countDifficulties(["medium", "medium"]))).toEqual({ kind: "single", difficulty: "medium" });
  });

  it("different difficulties give mixed", () => {
    expect(describeSetDifficulty(null, countDifficulties(["easy", "hard"]))).toEqual({ kind: "mixed" });
  });

  it("unrated questions don't make a set mixed or hide its difficulty", () => {
    expect(describeSetDifficulty(null, countDifficulties(["easy", "easy", null]))).toEqual({ kind: "single", difficulty: "easy" });
  });

  it("nothing rated is unrated", () => {
    expect(describeSetDifficulty(null, countDifficulties([null, null]))).toEqual({ kind: "unrated" });
    expect(describeSetDifficulty(null, countDifficulties([]))).toEqual({ kind: "unrated" });
  });

  it("the breakdown lists only what is present, in a fixed order", () => {
    expect(difficultyBreakdown({ easy: 4, medium: 9, hard: 5, unrated: 0 })).toBe("4 easy · 9 medium · 5 hard");
    expect(difficultyBreakdown({ easy: 0, medium: 0, hard: 2, unrated: 3 })).toBe("2 hard · 3 unrated");
  });
});

describe("pageOfIndex", () => {
  it("maps a 0-based item index to its 1-based page of 10", () => {
    expect(pageOfIndex(0)).toBe(1);
    expect(pageOfIndex(9)).toBe(1);
    expect(pageOfIndex(10)).toBe(2);
    expect(pageOfIndex(14)).toBe(2);
    expect(pageOfIndex(20)).toBe(3);
  });

  it("falls back to page 1 for invalid indexes", () => {
    for (const bad of [-1, 1.5, Number.NaN]) expect(pageOfIndex(bad)).toBe(1);
  });

  it("agrees with paginate's offsets", () => {
    for (let i = 0; i < 35; i++) {
      const page = pageOfIndex(i);
      const { offset } = paginate(35, page);
      expect(i).toBeGreaterThanOrEqual(offset);
      expect(i).toBeLessThan(offset + 10);
    }
  });
});
