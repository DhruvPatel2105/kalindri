import { describe, expect, it } from "vitest";

import {
  PART_BY_TYPE,
  QUESTION_TYPES,
  SKILLS,
  SKILLS_BY_TYPE,
} from "./types";

describe("QUESTION_TYPES", () => {
  it("has 19 values, derived from the Drizzle enum", () => {
    expect(QUESTION_TYPES).toHaveLength(19);
  });
});

describe("PART_BY_TYPE", () => {
  it("has an entry for every QuestionType, each 1, 2 or 3", () => {
    expect(Object.keys(PART_BY_TYPE).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
    for (const part of Object.values(PART_BY_TYPE)) {
      expect([1, 2, 3]).toContain(part);
    }
  });

  it("matches the test structure in docs/01-question-types.md", () => {
    expect(PART_BY_TYPE.READ_ALOUD).toBe(1);
    expect(PART_BY_TYPE.WRITE_EMAIL).toBe(1);
    expect(PART_BY_TYPE.MCS_READING).toBe(2);
    expect(PART_BY_TYPE.WRITE_FROM_DICTATION).toBe(3);
  });
});

describe("SKILLS_BY_TYPE", () => {
  it("has an entry for every QuestionType, using only known skills", () => {
    expect(Object.keys(SKILLS_BY_TYPE).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
    for (const skills of Object.values(SKILLS_BY_TYPE)) {
      expect(skills.length).toBeGreaterThan(0);
      for (const skill of skills) {
        expect(SKILLS).toContain(skill);
      }
    }
  });

  it("Read Aloud scores into both Reading and Speaking (Core-only rule)", () => {
    expect([...SKILLS_BY_TYPE.READ_ALOUD].sort()).toEqual([
      "reading",
      "speaking",
    ]);
  });

  it("Highlight Incorrect Words scores into both Listening and Reading", () => {
    expect([...SKILLS_BY_TYPE.HIGHLIGHT_INCORRECT_WORDS].sort()).toEqual([
      "listening",
      "reading",
    ]);
  });
});
