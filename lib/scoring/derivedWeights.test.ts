import { describe, expect, it } from "vitest";

import { OFFICIAL_QUESTION_COUNTS } from "@/lib/questions/labels";
import { QUESTION_TYPES, SKILLS_BY_TYPE } from "@/lib/questions/types";

import {
  DERIVED_WEIGHT_ROWS,
  formatWeight,
  groupWeights,
  SCORE_WEIGHT_DISCLOSURE,
  SKILL_ORDER,
  weightsForType,
  weightSummary,
} from "./derivedWeights";

describe("the derived weight rows (docs/02-scoring-spec.md §10)", () => {
  it("each skill's weights add up to 100%, within rounding", () => {
    for (const skill of SKILL_ORDER) {
      const total = DERIVED_WEIGHT_ROWS.filter((r) => r.skill === skill).reduce((s, r) => s + r.weightPct, 0);
      expect(Math.abs(total - 100), skill).toBeLessThan(0.3);
    }
  });

  it("a type only feeds the skills docs/01 says it feeds, and every one of them", () => {
    for (const type of QUESTION_TYPES) {
      const skills = DERIVED_WEIGHT_ROWS.filter((r) => r.questionType === type).map((r) => r.skill).sort();
      expect(skills, type).toEqual([...SKILLS_BY_TYPE[type]].sort());
    }
  });

  it("has no duplicate (type, skill) rows", () => {
    const keys = DERIVED_WEIGHT_ROWS.map((r) => `${r.questionType}/${r.skill}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches the Reading figures the home page has always quoted", () => {
    const pct = (type: string) => DERIVED_WEIGHT_ROWS.find((r) => r.skill === "reading" && r.questionType === type)?.weightPct;
    expect(pct("FIB_RW")).toBe(25.8);
    expect(pct("FIB_READING")).toBe(21.1);
    expect(pct("REORDER_PARAGRAPH")).toBe(9.4);
  });
});

describe("official question counts", () => {
  it("covers all 19 Core types", () => {
    expect(Object.keys(OFFICIAL_QUESTION_COUNTS).sort()).toEqual([...QUESTION_TYPES].sort());
  });
});

describe("formatting and grouping", () => {
  it("formatWeight shows one decimal", () => {
    expect(formatWeight(25.8)).toBe("25.8%");
    expect(formatWeight(7)).toBe("7.0%");
  });

  it("groupWeights lists each skill's tasks in task order with their official count", () => {
    const grouped = groupWeights(DERIVED_WEIGHT_ROWS);
    expect(grouped.reading.map((e) => e.questionType)).toEqual([
      "READ_ALOUD", "SUMMARIZE_WRITTEN_TEXT", "FIB_RW", "MCM_READING", "REORDER_PARAGRAPH", "FIB_READING", "MCS_READING", "HIGHLIGHT_INCORRECT_WORDS",
    ]);
    expect(grouped.speaking[0]).toMatchObject({ questionType: "READ_ALOUD", weightPct: 28.9, officialCount: "6–7" });
    expect(grouped.listening).toHaveLength(9);
  });

  it("groupWeights leaves out tasks with no row and still shows unexpected ones", () => {
    const grouped = groupWeights([{ questionType: "WRITE_EMAIL", skill: "writing", weightPct: 30 }]);
    expect(grouped.writing.map((e) => e.questionType)).toEqual(["WRITE_EMAIL"]);
    expect(grouped.reading).toEqual([]);
    const odd = groupWeights([{ questionType: "DESCRIBE_IMAGE", skill: "reading", weightPct: 1 }]);
    expect(odd.reading.map((e) => e.questionType)).toEqual(["DESCRIBE_IMAGE"]);
  });

  it("weightsForType and weightSummary list a type's skills in skill order", () => {
    expect(weightsForType(DERIVED_WEIGHT_ROWS, "FIB_RW")).toEqual([
      { skill: "writing", weightPct: 19.5 },
      { skill: "reading", weightPct: 25.8 },
    ]);
    expect(weightSummary(DERIVED_WEIGHT_ROWS, "FIB_RW")).toBe("19.5% of Writing · 25.8% of Reading");
    expect(weightSummary([], "FIB_RW")).toBeNull();
  });

  it("the disclosure says derivation, not official", () => {
    expect(SCORE_WEIGHT_DISCLOSURE).toMatch(/does not publish task weightings/);
    expect(SCORE_WEIGHT_DISCLOSURE).toMatch(/not an official figure/);
  });
});
