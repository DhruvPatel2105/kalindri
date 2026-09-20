import { describe, expect, it } from "vitest";

import { buildSessionState, extractQuestionSnapshot } from "./sessionState";

describe("buildSessionState / extractQuestionSnapshot round trip", () => {
  it("round-trips a snapshot exactly", () => {
    const snapshot = {
      id: "q-1",
      type: "MCS_READING" as const,
      payload: {
        passage: "text",
        question: "q?",
        options: [],
        correct_option_id: "a",
      },
    };
    const state = buildSessionState(snapshot);
    expect(extractQuestionSnapshot(state)).toEqual(snapshot);
  });

  it("preserves an arbitrary nested payload shape untouched", () => {
    const state = buildSessionState({
      id: "q-2",
      type: "FIB_RW",
      payload: { nested: { deeply: [1, 2, 3] } },
    });
    expect(extractQuestionSnapshot(state)?.payload).toEqual({
      nested: { deeply: [1, 2, 3] },
    });
  });
});

describe("extractQuestionSnapshot", () => {
  it("returns null for null state", () => {
    expect(extractQuestionSnapshot(null)).toBeNull();
  });

  it("returns null for undefined state", () => {
    expect(extractQuestionSnapshot(undefined)).toBeNull();
  });

  it("returns null for a state missing questionSnapshot", () => {
    expect(extractQuestionSnapshot({})).toBeNull();
  });

  it("returns null when questionSnapshot is missing required fields", () => {
    expect(
      extractQuestionSnapshot({ questionSnapshot: { id: "q-1" } }),
    ).toBeNull();
  });

  it("returns null for a state that isn't an object", () => {
    expect(extractQuestionSnapshot("not an object")).toBeNull();
    expect(extractQuestionSnapshot(42)).toBeNull();
  });

  it("never throws on malformed input", () => {
    expect(() => extractQuestionSnapshot(null)).not.toThrow();
    expect(() => extractQuestionSnapshot("garbage")).not.toThrow();
    expect(() =>
      extractQuestionSnapshot({ questionSnapshot: null }),
    ).not.toThrow();
    expect(() => extractQuestionSnapshot([1, 2, 3])).not.toThrow();
  });
});
