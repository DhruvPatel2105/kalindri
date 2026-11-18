import { describe, expect, it } from "vitest";

import { DEFAULT_SET_SIZE, parseSetSize, planSets } from "./buildSets";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i + 1}`);

describe("planSets", () => {
  it("splits into equal sets, numbered from 1, order preserved", () => {
    const { sets, leftover } = planSets(ids(6), 3);
    expect(sets).toEqual([
      { number: 1, questionIds: ["q1", "q2", "q3"] },
      { number: 2, questionIds: ["q4", "q5", "q6"] },
    ]);
    expect(leftover).toEqual([]);
  });

  it("keeps a short last set by default", () => {
    const { sets } = planSets(ids(7), 3);
    expect(sets.map((s) => s.questionIds.length)).toEqual([3, 3, 1]);
  });

  it("with fullSetsOnly, holds the remainder back instead", () => {
    const { sets, leftover } = planSets(ids(7), 3, { fullSetsOnly: true });
    expect(sets).toHaveLength(2);
    expect(leftover).toEqual(["q7"]);
  });

  it("continues numbering from startNumber", () => {
    const { sets } = planSets(ids(4), 2, { startNumber: 5 });
    expect(sets.map((s) => s.number)).toEqual([5, 6]);
  });

  it("no questions means no sets", () => {
    expect(planSets([], 15)).toEqual({ sets: [], leftover: [] });
  });

  it("never loses or repeats an id", () => {
    const { sets } = planSets(ids(23), 5);
    expect(sets.flatMap((s) => s.questionIds)).toEqual(ids(23));
  });

  it("rejects an invalid size", () => {
    expect(() => planSets(ids(3), 0)).toThrow();
    expect(() => planSets(ids(3), 1.5)).toThrow();
  });
});

describe("parseSetSize", () => {
  it("defaults to 15", () => {
    expect(parseSetSize(undefined)).toBe(DEFAULT_SET_SIZE);
    expect(DEFAULT_SET_SIZE).toBe(15);
  });

  it("reads a whole number in range", () => {
    expect(parseSetSize("10")).toBe(10);
  });

  it("rejects junk and out-of-range values", () => {
    for (const bad of ["", "abc", "0", "-3", "2.5", "51"]) {
      expect(() => parseSetSize(bad)).toThrow();
    }
  });
});
