import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import {
  DETERMINISTIC_QUESTION_TYPES,
  DETERMINISTIC_SCORER_FILES,
  NotDeterministicScorerError,
  SCORING_CATEGORIES,
  SCORING_CATEGORY_BY_TYPE,
  deterministicScorers,
  isDeterministicType,
  scoreDeterministic,
  type ScoringCategory,
} from "./registry";

describe("SCORING_CATEGORY_BY_TYPE", () => {
  it("assigns a category to every one of the 19 QuestionTypes — no gaps", () => {
    expect(Object.keys(SCORING_CATEGORY_BY_TYPE).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
  });

  it("every category value is non-empty and only uses known categories", () => {
    for (const type of QUESTION_TYPES) {
      const categories: readonly ScoringCategory[] =
        SCORING_CATEGORY_BY_TYPE[type];
      expect(categories.length).toBeGreaterThan(0);
      for (const category of categories) {
        expect(SCORING_CATEGORIES).toContain(category);
      }
    }
  });

  it("has exactly 11 deterministic types, matching docs/02-scoring-spec.md §3's rules table", () => {
    const deterministic = QUESTION_TYPES.filter((type) => {
      const categories: readonly ScoringCategory[] =
        SCORING_CATEGORY_BY_TYPE[type];
      return categories.includes("deterministic");
    });
    expect(deterministic.sort()).toEqual(
      [...DETERMINISTIC_QUESTION_TYPES].sort(),
    );
    expect(deterministic).toHaveLength(11);
  });

  it("has exactly 5 llm types and 5 speech types, per docs/02-scoring-spec.md §1", () => {
    const llm = QUESTION_TYPES.filter((type) => {
      const categories: readonly ScoringCategory[] =
        SCORING_CATEGORY_BY_TYPE[type];
      return categories.includes("llm");
    });
    const speech = QUESTION_TYPES.filter((type) => {
      const categories: readonly ScoringCategory[] =
        SCORING_CATEGORY_BY_TYPE[type];
      return categories.includes("speech");
    });
    expect(llm).toHaveLength(5);
    expect(speech).toHaveLength(5);
  });

  it("DESCRIBE_IMAGE and RESPOND_TO_SITUATION carry both llm (content) and speech (delivery)", () => {
    expect(SCORING_CATEGORY_BY_TYPE.DESCRIBE_IMAGE).toEqual(["llm", "speech"]);
    expect(SCORING_CATEGORY_BY_TYPE.RESPOND_TO_SITUATION).toEqual([
      "llm",
      "speech",
    ]);
  });
});

describe("isDeterministicType", () => {
  it("is true for exactly the 11 deterministic types", () => {
    for (const type of QUESTION_TYPES) {
      expect(isDeterministicType(type)).toBe(
        DETERMINISTIC_QUESTION_TYPES.includes(
          type as (typeof DETERMINISTIC_QUESTION_TYPES)[number],
        ),
      );
    }
  });
});

describe("deterministicScorers", () => {
  it("resolves every deterministic type to an actual callable function", () => {
    for (const type of DETERMINISTIC_QUESTION_TYPES) {
      expect(typeof deterministicScorers[type]).toBe("function");
    }
  });

  it("has no entries beyond the 11 deterministic types", () => {
    expect(Object.keys(deterministicScorers).sort()).toEqual(
      [...DETERMINISTIC_QUESTION_TYPES].sort(),
    );
  });
});

describe("scoreDeterministic", () => {
  it("MCS_READING: exact match on the selected option", () => {
    const result = scoreDeterministic(
      "MCS_READING",
      {
        passage: "Passage text.",
        question: "Question?",
        options: [
          { id: "a", text: "First" },
          { id: "b", text: "Second" },
        ],
        correct_option_id: "b",
      },
      "b",
    );
    expect(result).toMatchObject({ score: 1, maxScore: 1, correct: true });
  });

  it("MCM_READING: negative marking on multi-select", () => {
    const result = scoreDeterministic(
      "MCM_READING",
      {
        passage: "Passage text.",
        question: "Question?",
        options: [
          { id: "a", text: "First" },
          { id: "b", text: "Second" },
          { id: "c", text: "Third" },
        ],
        correct_option_ids: ["a", "b"],
      },
      ["a", "c"],
    );
    expect(result).toMatchObject({ score: 0, correctCount: 1, incorrectCount: 1 });
  });

  it("REORDER_PARAGRAPH: adjacent-pair scoring, full reversal scores 0", () => {
    const result = scoreDeterministic(
      "REORDER_PARAGRAPH",
      { boxes: ["A", "B", "C", "D"] },
      ["D", "C", "B", "A"],
    );
    expect(result).toEqual({ score: 0, maxScore: 3 });
  });

  it("WRITE_FROM_DICTATION: per-word spelling", () => {
    const result = scoreDeterministic(
      "WRITE_FROM_DICTATION",
      {
        sentence_text: "The quick brown fox jumps over the lazy dog",
        audio_url: "https://example.com/audio.mp3",
        accent: "en-US",
      },
      "The quick brown fox jumps over the lazy dog",
    );
    expect(result.score).toBe(result.maxScore);
  });

  it("FIB_RW: +1 per correct blank, no negative marking for a wrong blank", () => {
    const result = scoreDeterministic(
      "FIB_RW",
      {
        passage_with_blanks: "The cat sat on the {{1}} and {{2}}.",
        blanks: [
          {
            index: 1,
            options: ["mat", "hat", "bat", "rat"],
            correct_option: "mat",
          },
          {
            index: 2,
            options: ["slept", "ran", "flew", "swam"],
            correct_option: "slept",
          },
        ],
      },
      ["mat", "ran"],
    );
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(2);
  });

  it("FIB_READING: +1 per correct blank from the word bank", () => {
    const result = scoreDeterministic(
      "FIB_READING",
      {
        passage_with_blanks: "It was a {{1}} and {{2}} day.",
        word_bank: ["bright", "cold", "windy", "quiet"],
        correct_answers: ["bright", "cold"],
      },
      ["bright", "windy"],
    );
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(2);
  });

  it("FIB_LISTENING: scores only the blanked positions, by spelling", () => {
    const result = scoreDeterministic(
      "FIB_LISTENING",
      {
        transcript: "Please submit the form before Friday",
        audio_url: "https://example.com/audio.mp3",
        blank_word_indices: [3, 5],
      },
      ["form", "firday"],
    );
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(2);
  });

  it("HIGHLIGHT_INCORRECT_WORDS: negative marking on flagged indices", () => {
    const result = scoreDeterministic(
      "HIGHLIGHT_INCORRECT_WORDS",
      {
        true_transcript: "The train arrives at noon",
        altered_transcript: "The train arrives at moon",
        altered_word_indices: [4],
      },
      [4],
    );
    expect(result).toMatchObject({ score: 1, correctCount: 1, incorrectCount: 0 });
  });

  it("throws NotDeterministicScorerError, not a silent result, for an llm type", () => {
    expect(() =>
      scoreDeterministic(
        "WRITE_EMAIL" as Exclude<
          QuestionType,
          (typeof DETERMINISTIC_QUESTION_TYPES)[number]
        >,
        {},
        {},
      ),
    ).toThrow(NotDeterministicScorerError);
  });

  it("throws NotDeterministicScorerError, not a silent result, for a speech type", () => {
    expect(() =>
      scoreDeterministic(
        "READ_ALOUD" as Exclude<
          QuestionType,
          (typeof DETERMINISTIC_QUESTION_TYPES)[number]
        >,
        {},
        {},
      ),
    ).toThrow(NotDeterministicScorerError);
  });

  it("throws for every one of the 8 non-deterministic (llm/speech) types", () => {
    const nonDeterministic = QUESTION_TYPES.filter(
      (type) => !isDeterministicType(type),
    );
    expect(nonDeterministic).toHaveLength(8);
    for (const type of nonDeterministic) {
      expect(() =>
        scoreDeterministic(
          type as Exclude<
            QuestionType,
            (typeof DETERMINISTIC_QUESTION_TYPES)[number]
          >,
          {},
          {},
        ),
      ).toThrow(NotDeterministicScorerError);
    }
  });
});

describe("cross-check: registry vs. actual implemented scorers", () => {
  it("every deterministic scorer file this registry wires up has a matching test file, and vice versa", () => {
    const deterministicDir = path.join(__dirname, "deterministic");
    const files = fs.readdirSync(deterministicDir);
    const testFiles = files.filter(
      (f) => f.endsWith(".test.ts") && f !== "normalise.test.ts",
    );
    const testedBasenames = testFiles
      .map((f) => f.replace(/\.test\.ts$/, ""))
      .sort();

    expect(testedBasenames).toEqual([...DETERMINISTIC_SCORER_FILES].sort());
    expect(testFiles).toHaveLength(DETERMINISTIC_SCORER_FILES.length);
  });
});
