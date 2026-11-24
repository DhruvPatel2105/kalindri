import { describe, expect, it } from "vitest";

import { buildQuestionReview, type QuestionReview } from "./reviewModel";
import type { QuestionSnapshot } from "./testState";

const mcs: QuestionSnapshot = {
  id: "q1",
  type: "MCS_READING",
  payload: {
    passage: "P",
    question: "Which?",
    options: [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
      { id: "c", text: "Gamma" },
    ],
    correct_option_id: "b",
  },
};
const mcm: QuestionSnapshot = {
  id: "q2",
  type: "MCM_READING",
  payload: {
    passage: "P",
    question: "Which?",
    options: [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
      { id: "c", text: "Gamma" },
      { id: "d", text: "Delta" },
    ],
    correct_option_ids: ["a", "c"],
  },
};
const fibRw: QuestionSnapshot = {
  id: "q3",
  type: "FIB_RW",
  payload: {
    passage_with_blanks: "She {{1}} to work and {{2}} home.",
    blanks: [
      { index: 0, options: ["walks", "walk", "walked", "walking"], correct_option: "walks" },
      { index: 1, options: ["return", "returns", "returned", "returning"], correct_option: "returns" },
    ],
  },
};
const fibReading: QuestionSnapshot = {
  id: "q4",
  type: "FIB_READING",
  payload: {
    passage_with_blanks: "The {{1}} sat on the {{2}} today.",
    word_bank: ["cat", "mat", "dog"],
    correct_answers: ["cat", "mat"],
  },
};
const reorder: QuestionSnapshot = {
  id: "q5",
  type: "REORDER_PARAGRAPH",
  payload: { boxes: ["One.", "Two.", "Three.", "Four."] },
};

/** The review variant whose `type` field can be T (FIB_RW and FIB_READING share one). */
type Of<T> = QuestionReview extends infer R
  ? R extends { type: infer U }
    ? [T] extends [U]
      ? R
      : never
    : never
  : never;

function of<T extends QuestionReview["type"]>(review: QuestionReview, type: T): Of<T> {
  expect(review.type).toBe(type);
  return review as Of<T>;
}

describe("MCS_READING review", () => {
  it("right answer: the chosen option is selected and correct", () => {
    const r = of(buildQuestionReview(mcs, "b"), "MCS_READING");
    expect(r).toMatchObject({ answered: true, score: 1, maxScore: 1, kind: "correct" });
    expect(r.options.find((o) => o.id === "b")).toMatchObject({ selected: true, correct: true });
  });

  it("wrong answer: the chosen option is selected and not correct; the right one is marked", () => {
    const r = of(buildQuestionReview(mcs, "a"), "MCS_READING");
    expect(r).toMatchObject({ score: 0, kind: "incorrect" });
    expect(r.options.find((o) => o.id === "a")).toMatchObject({ selected: true, correct: false });
    expect(r.options.find((o) => o.id === "b")).toMatchObject({ selected: false, correct: true });
  });

  it("unanswered: nothing selected, the right answer is still shown, 0 of the marks", () => {
    for (const response of [undefined, null, ""]) {
      const r = of(buildQuestionReview(mcs, response), "MCS_READING");
      expect(r).toMatchObject({ answered: false, score: 0, maxScore: 1, kind: "unanswered" });
      expect(r.options.some((o) => o.selected)).toBe(false);
      expect(r.options.find((o) => o.correct)?.id).toBe("b");
    }
  });
});

describe("MCM_READING review", () => {
  it("flags each option selected / correct and reports negative marking", () => {
    // picks a (right) and d (wrong), misses c
    const r = of(buildQuestionReview(mcm, ["a", "d"]), "MCM_READING");
    expect(r.options.map((o) => [o.id, o.selected, o.correct])).toEqual([
      ["a", true, true],
      ["b", false, false],
      ["c", false, true],
      ["d", true, false],
    ]);
    expect(r).toMatchObject({ correctCount: 1, incorrectCount: 1, score: 0, maxScore: 2 });
    expect(r.kind).toBe("incorrect");
  });

  it("all right is correct; some right is partial", () => {
    expect(buildQuestionReview(mcm, ["a", "c"]).kind).toBe("correct");
    expect(buildQuestionReview(mcm, ["a"]).kind).toBe("partial");
  });

  it("an empty selection is unanswered", () => {
    expect(buildQuestionReview(mcm, []).kind).toBe("unanswered");
  });
});

describe("FIB_RW review", () => {
  it("marks each blank right or wrong with what was submitted beside the answer", () => {
    const r = of(buildQuestionReview(fibRw, ["walks", "return"]), "FIB_RW");
    expect(r.parts).toEqual(["She ", " to work and ", " home."]);
    expect(r.blanks).toEqual([
      { submitted: "walks", expected: "walks", correct: true },
      { submitted: "return", expected: "returns", correct: false },
    ]);
    expect(r).toMatchObject({ score: 1, maxScore: 2, kind: "partial" });
  });

  it("a blank left empty is wrong but still shows the right answer", () => {
    const r = of(buildQuestionReview(fibRw, ["walks", ""]), "FIB_RW");
    expect(r.answered).toBe(true);
    expect(r.blanks[1]).toEqual({ submitted: "", expected: "returns", correct: false });
  });

  it("nothing filled in is unanswered, with every expected answer available", () => {
    const r = of(buildQuestionReview(fibRw, ["", ""]), "FIB_RW");
    expect(r).toMatchObject({ answered: false, score: 0, maxScore: 2, kind: "unanswered" });
    expect(r.blanks.map((b) => b.expected)).toEqual(["walks", "returns"]);
  });
});

describe("FIB_READING review", () => {
  it("follows the scorer: case differences still count as right", () => {
    const r = of(buildQuestionReview(fibReading, ["Cat", "dog"]), "FIB_READING");
    expect(r.blanks.map((b) => b.correct)).toEqual([true, false]);
    expect(r).toMatchObject({ score: 1, maxScore: 2 });
  });
});

describe("REORDER_PARAGRAPH review", () => {
  it("a perfect order is all positions and pairs right", () => {
    const r = of(buildQuestionReview(reorder, ["One.", "Two.", "Three.", "Four."]), "REORDER_PARAGRAPH");
    expect(r.kind).toBe("correct");
    expect(r.positions.every((p) => p.correct)).toBe(true);
    expect(r.pairs.every((p) => p.correct)).toBe(true);
    expect(r).toMatchObject({ score: 3, maxScore: 3 });
  });

  it("shows your sentence beside the right one at each position, and which pairs held", () => {
    // Two/Three/One/Four: only the Three→? ... pair One→Two broken, Two→Three kept
    const r = of(buildQuestionReview(reorder, ["Two.", "Three.", "One.", "Four."]), "REORDER_PARAGRAPH");
    expect(r.positions[0]).toEqual({ position: 1, submitted: "Two.", expected: "One.", correct: false });
    expect(r.pairs.map((p) => p.correct)).toEqual([false, true, false]);
    expect(r).toMatchObject({ score: 1, maxScore: 3, kind: "partial" });
  });

  it("a partial ordering leaves the missing positions empty", () => {
    const r = of(buildQuestionReview(reorder, ["One.", "Two."]), "REORDER_PARAGRAPH");
    expect(r.positions[2]).toEqual({ position: 3, submitted: "", expected: "Three.", correct: false });
    expect(r.answered).toBe(true);
  });

  it("no ordering is unanswered and still reveals the correct order", () => {
    const r = of(buildQuestionReview(reorder, undefined), "REORDER_PARAGRAPH");
    expect(r).toMatchObject({ answered: false, score: 0, maxScore: 3, kind: "unanswered" });
    expect(r.positions.map((p) => p.expected)).toEqual(["One.", "Two.", "Three.", "Four."]);
  });
});

describe("unsupported types", () => {
  it("do not expose their payload", () => {
    const r = buildQuestionReview({ id: "x", type: "WRITE_EMAIL", payload: { secret: 1 } }, "text");
    expect(r.type).toBe("UNSUPPORTED");
    expect(JSON.stringify(r)).not.toContain("secret");
  });
});

describe("corrupt data", () => {
  it("throws rather than reviewing a payload that doesn't match its type", () => {
    expect(() => buildQuestionReview({ id: "x", type: "MCS_READING", payload: {} }, "a")).toThrow();
  });
});

describe("Fill in the Blanks notes and typed blanks", () => {
  const withNote: QuestionSnapshot = {
    id: "n1",
    type: "FIB_RW",
    payload: {
      passage_with_blanks: "Riders {{1}} the pass and {{2}} a receipt.",
      blanks: [
        { index: 1, options: ["renew", "renews", "renewed", "renewing"], correct_option: "renew" },
        { index: 2, options: null, correct_option: "Keep" },
      ],
      note: "Blank 2: keep fits.",
    },
  };

  it("carries the author's note and marks a typed blank ignoring capitals", () => {
    const right = buildQuestionReview(withNote, ["renew", "keep"]);
    expect(right.type).toBe("FIB_RW");
    if (right.type === "FIB_RW") {
      expect(right.note).toBe("Blank 2: keep fits.");
      expect(right.score).toBe(right.maxScore);
    }
    const wrong = buildQuestionReview(withNote, ["renew", "keeps"]);
    expect(wrong.score).toBe(1);
  });

  it("has no note when the question has none", () => {
    const plain = buildQuestionReview({ ...withNote, payload: { ...(withNote.payload as object), note: undefined } }, ["renew", "keep"]);
    if (plain.type === "FIB_RW") expect(plain.note).toBeNull();
  });
});
