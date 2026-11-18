import { describe, expect, it } from "vitest";

import { toClientQuestion, type ClientQuestion } from "./clientQuestion";
import { splitReorderBoxes } from "./reorderBoxes";
import type { QuestionSnapshot } from "./testState";

const identity = <T>(items: readonly T[]) => [...items];
const reversed = <T>(items: readonly T[]) => [...items].reverse();

const mcs: QuestionSnapshot = {
  id: "q-mcs",
  type: "MCS_READING",
  payload: {
    passage: "A passage.",
    question: "Which?",
    options: [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
    ],
    correct_option_id: "b",
  },
};
const mcm: QuestionSnapshot = {
  id: "q-mcm",
  type: "MCM_READING",
  payload: {
    passage: "A passage.",
    question: "Which?",
    options: [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
      { id: "c", text: "Gamma" },
    ],
    correct_option_ids: ["a", "c"],
  },
};
const reorder: QuestionSnapshot = {
  id: "q-re",
  type: "REORDER_PARAGRAPH",
  payload: { boxes: ["First sentence.", "Second sentence.", "Third sentence."] },
};
const fibReading: QuestionSnapshot = {
  id: "q-fr",
  type: "FIB_READING",
  payload: {
    passage_with_blanks: "The {{1}} sat on the {{2}} today.",
    word_bank: ["cat", "mat", "dog"],
    correct_answers: ["cat", "mat"],
  },
};
const fibRw: QuestionSnapshot = {
  id: "q-rw",
  type: "FIB_RW",
  payload: {
    passage_with_blanks: "She {{1}} to work and {{2}} home.",
    blanks: [
      { index: 0, options: ["walks", "walk", "walked", "walking"], correct_option: "walks" },
      { index: 1, options: ["return", "returns", "returned", "returning"], correct_option: "returns" },
    ],
  },
};

describe("toClientQuestion never sends an answer key", () => {
  const cases: [string, QuestionSnapshot, string[]][] = [
    ["MCS_READING", mcs, ["correct_option_id"]],
    ["MCM_READING", mcm, ["correct_option_ids"]],
    ["FIB_RW", fibRw, ["correct_option"]],
    ["FIB_READING", fibReading, ["correct_answers"]],
  ];

  for (const [name, snapshot, forbiddenKeys] of cases) {
    it(`${name}: no answer-key field in the output`, () => {
      const json = JSON.stringify(toClientQuestion(snapshot, identity));
      for (const key of forbiddenKeys) expect(json).not.toContain(key);
    });
  }

  it("MCS: the correct option is not marked in any way", () => {
    const out = toClientQuestion(mcs, identity);
    expect(out.kind === "MCS_READING" && out.options).toEqual([
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
    ]);
  });
});

describe("toClientQuestion shapes", () => {
  it("MCM_READING keeps passage, question and options", () => {
    const out = toClientQuestion(mcm, identity);
    expect(out).toMatchObject({
      kind: "MCM_READING",
      id: "q-mcm",
      questionText: "Which?",
    });
  });

  it("REORDER_PARAGRAPH is shuffled and keyed by position, not true order", () => {
    const out = toClientQuestion(reorder, reversed) as Extract<
      ClientQuestion,
      { kind: "REORDER_PARAGRAPH" }
    >;
    expect(out.boxes.map((b) => b.text)).toEqual([
      "Third sentence.",
      "Second sentence.",
      "First sentence.",
    ]);
    expect(out.boxes.map((b) => b.key)).toEqual(["box-0", "box-1", "box-2"]);
  });

  it("FIB_READING splits the passage at the gaps and shuffles the bank", () => {
    const out = toClientQuestion(fibReading, reversed) as Extract<
      ClientQuestion,
      { kind: "FIB_READING" }
    >;
    expect(out.parts).toEqual(["The ", " sat on the ", " today."]);
    expect(out.wordBank).toEqual(["dog", "mat", "cat"]);
  });

  it("FIB_RW splits the passage and sends only the options", () => {
    const out = toClientQuestion(fibRw, identity) as Extract<
      ClientQuestion,
      { kind: "FIB_RW" }
    >;
    expect(out.parts).toEqual(["She ", " to work and ", " home."]);
    expect(out.blanks).toEqual([
      { options: ["walks", "walk", "walked", "walking"] },
      { options: ["return", "returns", "returned", "returning"] },
    ]);
  });

  it("a type with no practice UI is marked unsupported, with no payload", () => {
    const out = toClientQuestion(
      { id: "q-x", type: "WRITE_EMAIL", payload: { secret: "x" } },
      identity,
    );
    expect(out).toEqual({ kind: "UNSUPPORTED", id: "q-x", type: "WRITE_EMAIL" });
  });

  it("throws on a payload that doesn't match its type's schema", () => {
    expect(() =>
      toClientQuestion({ id: "q", type: "MCS_READING", payload: {} }, identity),
    ).toThrow();
  });
});

describe("splitReorderBoxes", () => {
  const boxes = [
    { key: "box-0", text: "B" },
    { key: "box-1", text: "C" },
    { key: "box-2", text: "A" },
  ];

  it("with no answer, everything is in the source", () => {
    expect(splitReorderBoxes(boxes, [])).toEqual({ source: boxes, target: [] });
  });

  it("places boxes in the saved order and leaves the rest in the source", () => {
    const { source, target } = splitReorderBoxes(boxes, ["A", "B"]);
    expect(target.map((b) => b.text)).toEqual(["A", "B"]);
    expect(source.map((b) => b.text)).toEqual(["C"]);
  });

  it("uses each box at most once, even if the text repeats", () => {
    const dup = [
      { key: "box-0", text: "X" },
      { key: "box-1", text: "X" },
    ];
    const { source, target } = splitReorderBoxes(dup, ["X", "X", "X"]);
    expect(target).toHaveLength(2);
    expect(source).toHaveLength(0);
  });

  it("ignores saved text that matches no box", () => {
    const { target } = splitReorderBoxes(boxes, ["nope"]);
    expect(target).toEqual([]);
  });
});
