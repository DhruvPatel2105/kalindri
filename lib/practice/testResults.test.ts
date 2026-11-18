import { describe, expect, it } from "vitest";

import { scoreDeterministic } from "@/lib/scoring/registry";

import {
  accuracyPercent,
  completionPercent,
  percentOf,
  parseStoredSummary,
  questionsToReview,
  resultKind,
  summarizeTest,
} from "./testResults";
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

  it("accuracy is correct answers over ALL questions; unanswered and partly correct count as not correct", () => {
    expect(summarizeTest(outcomes).accuracyPercent).toBe(40); // 2 correct of 5 questions
  });

  it("accuracy differs from the marks percentage", () => {
    const s = summarizeTest(outcomes);
    expect(s.percent).toBe(Math.round((4 / 9) * 100)); // 2+1+0+1 of 2+2+2+1+2
  });

  it("accuracy is withheld while an answer is still awaiting its mark, rather than understated", () => {
    const s = summarizeTest([
      { answered: true, score: null, maxScore: 2 },
      { answered: true, score: 2, maxScore: 2 },
    ]);
    expect(s).toMatchObject({ correct: 1, unscored: 1, accuracyPercent: null });
  });

  it("answering nothing is 0% accuracy; a test with no questions has none", () => {
    expect(summarizeTest([{ answered: false, score: null, maxScore: 1 }]).accuracyPercent).toBe(0);
    expect(summarizeTest([]).accuracyPercent).toBeNull();
  });

  it("a blank question and a wrong one both count as not correct", () => {
    const blank = summarizeTest([
      { answered: true, score: 1, maxScore: 1 },
      { answered: false, score: null, maxScore: 1 },
    ]);
    const wrong = summarizeTest([
      { answered: true, score: 1, maxScore: 1 },
      { answered: true, score: 0, maxScore: 1 },
    ]);
    expect(blank.accuracyPercent).toBe(50);
    expect(wrong.accuracyPercent).toBe(50);
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

describe("accuracyPercent", () => {
  it("is correct ÷ total × 100, rounded", () => {
    expect(accuracyPercent(10, 15)).toBe(67);
    expect(accuracyPercent(15, 15)).toBe(100);
    expect(accuracyPercent(0, 15)).toBe(0);
  });

  it("is null when there are no questions, never NaN or a divide by zero", () => {
    expect(accuracyPercent(0, 0)).toBeNull();
    expect(accuracyPercent(3, -1)).toBeNull();
  });
});

describe("parseStoredSummary", () => {
  it("recomputes accuracy from the counts, ignoring a figure stored under an older definition", () => {
    const summary = summarizeTest([
      { answered: true, score: 2, maxScore: 2 },
      { answered: true, score: 0, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
    ]);
    const stale = { ...summary, accuracyPercent: 50 }; // old formula: 1 of 2 answered
    expect(parseStoredSummary(JSON.parse(JSON.stringify(stale)))?.accuracyPercent).toBe(25); // 1 of 4 questions
  });

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

describe("percentOf (the one shared percentage)", () => {
  it("rounds to a whole number", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(1, 8)).toBe(13); // 12.5 rounds up
  });

  it("an empty or invalid denominator is null, never NaN or Infinity", () => {
    for (const d of [0, -1, Number.NaN]) expect(percentOf(5, d)).toBeNull();
    expect(percentOf(Number.NaN, 5)).toBeNull();
  });
});

describe("completion rate", () => {
  it("is attempted ÷ total × 100, independent of whether the answers were right", () => {
    expect(completionPercent(12, 15)).toBe(80);
    const s = summarizeTest([
      { answered: true, score: 0, maxScore: 2 }, // attempted, wrong
      { answered: true, score: 2, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
    ]);
    expect(s.completionPercent).toBe(50);
    expect(s.accuracyPercent).toBe(25);
  });

  it("is available even while answers await a mark (attempted is known), and null for an empty test", () => {
    expect(summarizeTest([{ answered: true, score: null, maxScore: 2 }]).completionPercent).toBe(100);
    expect(summarizeTest([]).completionPercent).toBeNull();
  });

  it("is recomputed from the stored counts, so older stored summaries get it too", () => {
    const summary = summarizeTest([
      { answered: true, score: 2, maxScore: 2 },
      { answered: false, score: null, maxScore: 2 },
    ]);
    const old = JSON.parse(JSON.stringify(summary));
    delete old.completionPercent; // saved before the field existed
    expect(parseStoredSummary(old)?.completionPercent).toBe(50);
  });
});
