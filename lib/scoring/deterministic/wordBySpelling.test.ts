import { describe, expect, it } from "vitest";

import {
  scoreFibListening,
  scoreWordBySpelling,
  scoreWriteFromDictation,
} from "./wordBySpelling";

describe("scoreWordBySpelling", () => {
  it("all correct: full score, case and edge punctuation ignored", () => {
    const result = scoreWordBySpelling([
      { expected: "the", submitted: "The" },
      { expected: "train", submitted: "train" },
      { expected: "station", submitted: "station." },
    ]);
    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(3);
    expect(result.words.every((w) => w.correct)).toBe(true);
  });

  it("one misspelled word loses credit for ONLY that word", () => {
    const result = scoreWordBySpelling([
      { expected: "the", submitted: "the" },
      { expected: "train", submitted: "trian" }, // misspelled
      { expected: "station", submitted: "station" },
    ]);
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(3);
    expect(result.words[0]?.correct).toBe(true);
    expect(result.words[1]?.correct).toBe(false);
    expect(result.words[2]?.correct).toBe(true);
  });

  it("completely wrong: every word scores 0", () => {
    const result = scoreWordBySpelling([
      { expected: "the", submitted: "xyz" },
      { expected: "train", submitted: "abc" },
    ]);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(2);
  });

  it("spelling is exact — an internal letter difference is wrong even though it sounds similar", () => {
    const result = scoreWordBySpelling([
      { expected: "their", submitted: "there" },
    ]);
    expect(result.score).toBe(0);
  });

  it("an apostrophe inside a word (contraction) matters for spelling", () => {
    const result = scoreWordBySpelling([
      { expected: "don't", submitted: "dont" },
    ]);
    expect(result.score).toBe(0);
  });
});

describe("scoreWriteFromDictation", () => {
  it("all correct: full score", () => {
    const result = scoreWriteFromDictation({
      targetSentence: "The train leaves at nine.",
      studentResponse: "The train leaves at nine.",
    });
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
  });

  it("one misspelled word loses credit only for that word", () => {
    const result = scoreWriteFromDictation({
      targetSentence: "The train leaves at nine.",
      studentResponse: "The trian leaves at nine.",
    });
    expect(result.score).toBe(4);
    expect(result.maxScore).toBe(5);
    expect(result.words[1]?.correct).toBe(false);
    expect(result.words.filter((w) => w.correct)).toHaveLength(4);
  });

  it("completely wrong response scores 0", () => {
    const result = scoreWriteFromDictation({
      targetSentence: "The train leaves at nine.",
      studentResponse: "Purple elephants dance quietly outside.",
    });
    expect(result.score).toBe(0);
  });

  it("a missing trailing word scores 0 for that position only", () => {
    const result = scoreWriteFromDictation({
      targetSentence: "The train leaves at nine.",
      studentResponse: "The train leaves at",
    });
    expect(result.maxScore).toBe(5);
    expect(result.score).toBe(4);
    expect(result.words[4]?.correct).toBe(false);
  });

  it("extra trailing words are ignored, not penalised or double-counted", () => {
    const result = scoreWriteFromDictation({
      targetSentence: "The train leaves at nine.",
      studentResponse: "The train leaves at nine and then some extra words.",
    });
    expect(result.maxScore).toBe(5);
    expect(result.score).toBe(5);
  });
});

describe("scoreFibListening", () => {
  const transcript = "The meeting has been moved to Thursday afternoon.";

  it("all blanks correctly filled: full score", () => {
    const result = scoreFibListening({
      transcript,
      blankWordIndices: [1, 6], // "meeting", "Thursday"
      submittedWords: ["meeting", "Thursday"],
    });
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(2);
  });

  it("one misspelled blank loses credit only for that blank", () => {
    const result = scoreFibListening({
      transcript,
      blankWordIndices: [1, 6],
      submittedWords: ["meeting", "Thersday"], // misspelled
    });
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(2);
    expect(result.words[0]?.correct).toBe(true);
    expect(result.words[1]?.correct).toBe(false);
  });

  it("case differences in a blank are still correct", () => {
    const result = scoreFibListening({
      transcript,
      blankWordIndices: [1],
      submittedWords: ["MEETING"],
    });
    expect(result.score).toBe(1);
  });
});
