import { describe, expect, it } from "vitest";

import {
  answerStatuses,
  buildTestState,
  clampIndex,
  countAnswered,
  emptyResponseFor,
  extractTestState,
  formatDuration,
  isAnswered,
} from "./testState";

describe("isAnswered", () => {
  it("treats a non-blank string as answered", () => {
    expect(isAnswered("opt-b")).toBe(true);
  });

  it("treats blank, missing and non-response values as unanswered", () => {
    for (const r of ["", "   ", undefined, null, 5, {}]) {
      expect(isAnswered(r)).toBe(false);
    }
  });

  it("an empty array, or an array of blank strings, is unanswered", () => {
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(["", "  ", ""])).toBe(false);
  });

  it("any filled slot makes a fill-in-the-blanks response answered", () => {
    expect(isAnswered(["", "which", ""])).toBe(true);
  });

  it("a selection or an ordering is answered", () => {
    expect(isAnswered(["a", "c"])).toBe(true);
    expect(isAnswered(["s1", "s3", "s2"])).toBe(true);
  });
});

describe("answerStatuses / countAnswered", () => {
  const ids = ["q1", "q2", "q3"];
  const answers = { q1: "x", q3: ["", ""] };

  it("reports one status per question in order", () => {
    expect(answerStatuses(ids, answers)).toEqual([
      "answered",
      "unanswered",
      "unanswered",
    ]);
  });

  it("ignores answers for ids that are not in the test", () => {
    expect(countAnswered(ids, { ...answers, stray: "y" })).toBe(1);
  });

  it("is all unanswered with no answers", () => {
    expect(countAnswered(ids, {})).toBe(0);
  });
});

describe("test state round trip", () => {
  it("extracts what buildTestState wrote", () => {
    const state = buildTestState([
      { id: "q1", type: "MCS_READING", payload: { a: 1 } },
    ]);
    expect(extractTestState(state)).toEqual(state);
  });

  it("defaults a missing answers map to empty", () => {
    expect(
      extractTestState({ snapshots: [{ id: "q1", type: "FIB_RW", payload: {} }] })
        ?.answers,
    ).toEqual({});
  });

  it("returns null instead of throwing on garbage", () => {
    for (const bad of [null, undefined, 3, "x", {}, { snapshots: "no" }]) {
      expect(extractTestState(bad)).toBeNull();
    }
  });
});

describe("emptyResponseFor", () => {
  it("is a string for single-answer types and an array otherwise", () => {
    expect(emptyResponseFor("MCS_READING")).toBe("");
    expect(emptyResponseFor("MCM_READING")).toEqual([]);
    expect(emptyResponseFor("REORDER_PARAGRAPH")).toEqual([]);
    expect(emptyResponseFor("FIB_RW")).toEqual([]);
  });
});

describe("clampIndex", () => {
  it("keeps an in-range index", () => {
    expect(clampIndex(3, 10)).toBe(3);
  });

  it("clamps below and above the range", () => {
    expect(clampIndex(-4, 10)).toBe(0);
    expect(clampIndex(99, 10)).toBe(9);
  });

  it("falls back to 0 for non-integers and empty sets", () => {
    expect(clampIndex(1.5, 10)).toBe(0);
    expect(clampIndex(Number.NaN, 10)).toBe(0);
    expect(clampIndex(2, 0)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(725_000)).toBe("12m 05s");
    expect(formatDuration(3_720_000)).toBe("1h 02m");
  });

  it("treats negative or invalid input as 0s", () => {
    expect(formatDuration(-5)).toBe("0s");
    expect(formatDuration(Number.NaN)).toBe("0s");
  });
});
