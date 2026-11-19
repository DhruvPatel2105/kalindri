import { describe, expect, it } from "vitest";

import { clampCount, parseCountParam, pickQuestionIds, seededRandom } from "./questionCount";

const ids = Array.from({ length: 15 }, (_, i) => `q${i + 1}`);

describe("parseCountParam", () => {
  it("reads a positive whole number", () => {
    expect(parseCountParam("10")).toBe(10);
    expect(parseCountParam(["7", "9"])).toBe(7);
  });

  it("anything else means the whole set", () => {
    for (const raw of [undefined, "", "abc", "0", "-3", "2.5", "1e2", " 4"]) {
      expect(parseCountParam(raw)).toBeUndefined();
    }
  });
});

describe("clampCount", () => {
  it("holds a request to 1..available", () => {
    expect(clampCount(10, 15)).toBe(10);
    expect(clampCount(99, 15)).toBe(15);
    expect(clampCount(1, 15)).toBe(1);
  });

  it("no valid request means all of them", () => {
    for (const bad of [undefined, 0, -2, 2.5, Number.NaN]) expect(clampCount(bad, 15)).toBe(15);
  });

  it("nothing available is zero", () => {
    expect(clampCount(5, 0)).toBe(0);
  });
});

describe("pickQuestionIds", () => {
  it("returns exactly the requested number, without repeats, all from the set", () => {
    const picked = pickQuestionIds(ids, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    for (const id of picked) expect(ids).toContain(id);
  });

  it("keeps the set's own order", () => {
    for (let run = 0; run < 25; run++) {
      const picked = pickQuestionIds(ids, 6);
      const positions = picked.map((id) => ids.indexOf(id));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it("asking for all (or more) returns the whole set untouched", () => {
    expect(pickQuestionIds(ids, 15)).toEqual(ids);
    expect(pickQuestionIds(ids, 40)).toEqual(ids);
  });

  it("is a different selection from run to run (it is random)", () => {
    const seen = new Set(Array.from({ length: 30 }, () => pickQuestionIds(ids, 5).join(",")));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("every question can be picked — no position is left out of the draw", () => {
    const hits = new Set<string>();
    for (let run = 0; run < 400; run++) for (const id of pickQuestionIds(ids, 3)) hits.add(id);
    expect(hits.size).toBe(15);
  });

  it("is deterministic with an injected random source", () => {
    const always0 = () => 0;
    expect(pickQuestionIds(["a", "b", "c", "d"], 2, always0)).toEqual(["a", "b"]);
  });

  it("handles an empty set and does not modify its input", () => {
    expect(pickQuestionIds([], 3)).toEqual([]);
    const copy = [...ids];
    pickQuestionIds(ids, 4);
    expect(ids).toEqual(copy);
  });
});

describe("seededRandom", () => {
  it("gives the same picks for the same seed, and stays in 0..1", () => {
    const a = pickQuestionIds(ids, 5, seededRandom("abc123"));
    const b = pickQuestionIds(ids, 5, seededRandom("abc123"));
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
    const r = seededRandom("x");
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds usually pick different questions", () => {
    const picks = new Set(["a", "b", "c", "d", "e", "f"].map((s) => pickQuestionIds(ids, 5, seededRandom(s)).join()));
    expect(picks.size).toBeGreaterThan(1);
  });
});
