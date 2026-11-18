import { describe, expect, it } from "vitest";

import { scoreDeterministic } from "@/lib/scoring/registry";

import { parseStoredSummary, questionsToReview, resultKind, summarizeTest } from "./testResults";
import { emptyResponseFor } from "./testState";

describe("summarizeTest", () => {
  it("totals marks and counts answered vs unanswered", () => {
    const summary = summarizeTest([
      { answered: true, score: 3, maxScore: 4 },
      { answered: false, score: null, maxScore: 4 },
      { answered: true, score: 1, maxScore: 1 },
    ]);
    expect(summary).toMatchObject({
      totalQuestions: 3,
      answered: 2,
      unanswered: 1,
      unscored: 0,
      score: 4,
      maxScore: 9,
      percent: 44,
    });
  });

  it("an unanswered question still counts its available marks against the total", () => {
    const summary = summarizeTest([
      { answered: true, score: 2, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
    ]);
    expect(summary.percent).toBe(50);
  });

  it("flags answered questions whose score is missing, without inventing marks", () => {
    const summary = summarizeTest([
      { answered: true, score: null, maxScore: 3 },
      { answered: true, score: 3, maxScore: 3 },
    ]);
    expect(summary.unscored).toBe(1);
    expect(summary.score).toBe(3);
    expect(summary.maxScore).toBe(6);
  });

  it("an empty test has no percentage", () => {
    expect(summarizeTest([])).toMatchObject({
      totalQuestions: 0,
      score: 0,
      maxScore: 0,
      percent: null,
    });
  });
});

describe("available marks for an unanswered question", () => {
  // The engine learns the maximum of a question nobody answered by scoring
  // the type's empty response, so each Reading scorer must accept one and
  // report the real maximum (not 0, not a throw).
  it("MCS_READING: 1 mark", () => {
    const result = scoreDeterministic(
      "MCS_READING",
      {
        passage: "p",
        question: "q",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
        correct_option_id: "a",
      },
      emptyResponseFor("MCS_READING") as string,
    );
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(1);
  });

  it("MCM_READING: one mark per correct option, floor 0", () => {
    const result = scoreDeterministic(
      "MCM_READING",
      {
        passage: "p",
        question: "q",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
          { id: "c", text: "C" },
        ],
        correct_option_ids: ["a", "c"],
      },
      emptyResponseFor("MCM_READING") as string[],
    );
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(2);
  });

  it("FIB_RW and FIB_READING: one mark per blank", () => {
    const rw = scoreDeterministic(
      "FIB_RW",
      {
        passage_with_blanks: "x {{1}} y {{2}}",
        blanks: [
          { index: 0, options: ["a", "b", "c", "d"], correct_option: "a" },
          { index: 1, options: ["e", "f", "g", "h"], correct_option: "e" },
        ],
      },
      emptyResponseFor("FIB_RW") as string[],
    );
    expect(rw).toMatchObject({ score: 0, maxScore: 2 });

    const reading = scoreDeterministic(
      "FIB_READING",
      {
        passage_with_blanks: "x {{1}} y {{2}}",
        word_bank: ["a", "e", "z"],
        correct_answers: ["a", "e"],
      },
      emptyResponseFor("FIB_READING") as string[],
    );
    expect(reading).toMatchObject({ score: 0, maxScore: 2 });
  });

  it("REORDER_PARAGRAPH: N boxes -> N-1 marks", () => {
    const result = scoreDeterministic(
      "REORDER_PARAGRAPH",
      { boxes: ["one", "two", "three", "four"] },
      emptyResponseFor("REORDER_PARAGRAPH") as string[],
    );
    expect(result).toMatchObject({ score: 0, maxScore: 3 });
  });
});

describe("resultKind", () => {
  it("full marks is correct, some is partial, none is incorrect", () => {
    expect(resultKind({ answered: true, score: 3, maxScore: 3 })).toBe("correct");
    expect(resultKind({ answered: true, score: 1, maxScore: 3 })).toBe("partial");
    expect(resultKind({ answered: true, score: 0, maxScore: 3 })).toBe("incorrect");
  });

  it("no answer is unanswered, whatever the marks", () => {
    expect(resultKind({ answered: false, score: null, maxScore: 3 })).toBe("unanswered");
    expect(resultKind({ answered: false, score: 0, maxScore: 3 })).toBe("unanswered");
  });

  it("an answer that hasn't been marked yet has no kind", () => {
    expect(resultKind({ answered: true, score: null, maxScore: 3 })).toBeNull();
  });
});

describe("summarizeTest counts and accuracy", () => {
  const outcomes = [
    { answered: true, score: 2, maxScore: 2 }, // correct
    { answered: true, score: 1, maxScore: 2 }, // partial
    { answered: true, score: 0, maxScore: 2 }, // incorrect
    { answered: true, score: 1, maxScore: 1 }, // correct
    { answered: false, score: null, maxScore: 2 }, // unanswered
  ];

  it("counts correct, partial, incorrect and unanswered, adding up to the total", () => {
    const s = summarizeTest(outcomes);
    expect(s).toMatchObject({ correct: 2, partial: 1, incorrect: 1, unanswered: 1, totalQuestions: 5 });
    expect(s.correct + s.partial + s.incorrect + s.unanswered + s.unscored).toBe(s.totalQuestions);
  });

  it("accuracy is full-marks questions over answered, unanswered left out", () => {
    expect(summarizeTest(outcomes).accuracyPercent).toBe(50); // 2 of 4 answered
  });

  it("accuracy differs from the marks percentage", () => {
    const s = summarizeTest(outcomes);
    expect(s.percent).toBe(Math.round((4 / 9) * 100)); // 2+1+0+1 of 2+2+2+1+2
  });

  it("answers still awaiting a mark are in neither the counts nor the accuracy", () => {
    const s = summarizeTest([
      { answered: true, score: null, maxScore: 2 },
      { answered: true, score: 2, maxScore: 2 },
    ]);
    expect(s).toMatchObject({ correct: 1, unscored: 1, accuracyPercent: 100 });
  });

  it("no answers means no accuracy", () => {
    expect(summarizeTest([{ answered: false, score: null, maxScore: 1 }]).accuracyPercent).toBeNull();
    expect(summarizeTest([]).accuracyPercent).toBeNull();
  });
});

describe("questionsToReview", () => {
  it("lists every non-correct question in order with its kind", () => {
    expect(
      questionsToReview([
        { answered: true, score: 2, maxScore: 2 },
        { answered: true, score: 0, maxScore: 2 },
        { answered: false, score: null, maxScore: 2 },
        { answered: true, score: 1, maxScore: 2 },
      ]),
    ).toEqual([
      { index: 1, kind: "incorrect" },
      { index: 2, kind: "unanswered" },
      { index: 3, kind: "partial" },
    ]);
  });

  it("is empty when everything is right, and skips unmarked answers", () => {
    expect(questionsToReview([{ answered: true, score: 1, maxScore: 1 }])).toEqual([]);
    expect(questionsToReview([{ answered: true, score: null, maxScore: 1 }])).toEqual([]);
  });
});

describe("parseStoredSummary", () => {
  it("round-trips a summary through JSON", () => {
    const summary = summarizeTest([
      { answered: true, score: 2, maxScore: 2 },
      { answered: true, score: 0, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
    ]);
    expect(parseStoredSummary(JSON.parse(JSON.stringify(summary)))).toEqual(summary);
  });

  it("round-trips an empty test (null percentages)", () => {
    const summary = summarizeTest([]);
    expect(parseStoredSummary(JSON.parse(JSON.stringify(summary)))).toEqual(summary);
  });

  it("returns null for anything that isn't a summary, instead of throwing", () => {
    for (const bad of [null, undefined, 5, "x", {}, { score: 1 }, { ...summarizeTest([]), correct: -1 }]) {
      expect(parseStoredSummary(bad)).toBeNull();
    }
  });
});
