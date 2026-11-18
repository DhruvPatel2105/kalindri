/**
 * Cross-skill score weights: how much each question type contributes to each
 * skill's score. Pure helpers plus the SEED values for the `skill_weights`
 * table.
 *
 * HONESTY (CLAUDE.md, docs/02-scoring-spec.md §10): Pearson publishes NO
 * task-level weightings. These are our DERIVATION from Pearson's published
 * question counts and rubric maximums — never "official", never "based on
 * Pearson's weighting guidelines" — and every surface that shows them must
 * carry SCORE_WEIGHT_DISCLOSURE. The numbers shown in the app are read from
 * the `skill_weights` table (so they can be corrected without a code change);
 * DERIVED_WEIGHT_ROWS below is only what that table is seeded with.
 */

import { OFFICIAL_QUESTION_COUNTS } from "@/lib/questions/labels";
import type { QuestionType, Skill } from "@/lib/questions/types";

/** Required wherever weights or estimated scores appear (CLAUDE.md). */
export const SCORE_WEIGHT_DISCLOSURE =
  "Estimated using Pearson's published question counts and scoring rubrics. Pearson does not publish task weightings. This is our derivation, not an official figure.";

export const DERIVED_SOURCE = "derived_v1";

export const DERIVED_METHOD_NOTE =
  "Derived, not official. Raw points contributed to a skill = midpoint of Pearson's published question count × points toward that skill (rubric maximums), normalised to 100% within each skill. Assumptions: Read Aloud content modelled as a 0–5 equivalent; pronunciation and fluency count toward Speaking only; dual-skill written tasks (Summarize Written Text, Summarize Spoken Text, Highlight Incorrect Words) split evenly between their two skills; R&W Fill in the Blanks ≈ 5 blanks, Listening Fill in the Blanks ≈ 7 blanks, Write from Dictation ≈ 9 words per item. See docs/02-scoring-spec.md §10.";

/** The order skills are shown in. */
export const SKILL_ORDER: readonly Skill[] = ["speaking", "writing", "reading", "listening"];

export const SKILL_LABELS: Record<Skill, string> = {
  speaking: "Speaking",
  writing: "Writing",
  reading: "Reading",
  listening: "Listening",
};

/** The order tasks are listed in within each skill (the official task order). */
export const TASK_ORDER: Record<Skill, readonly QuestionType[]> = {
  speaking: ["READ_ALOUD", "REPEAT_SENTENCE", "DESCRIBE_IMAGE", "ANSWER_SHORT_QUESTION", "RESPOND_TO_SITUATION"],
  writing: ["SUMMARIZE_WRITTEN_TEXT", "WRITE_EMAIL", "FIB_RW", "SUMMARIZE_SPOKEN_TEXT", "FIB_LISTENING", "WRITE_FROM_DICTATION"],
  reading: ["READ_ALOUD", "SUMMARIZE_WRITTEN_TEXT", "FIB_RW", "MCM_READING", "REORDER_PARAGRAPH", "FIB_READING", "MCS_READING", "HIGHLIGHT_INCORRECT_WORDS"],
  listening: ["REPEAT_SENTENCE", "ANSWER_SHORT_QUESTION", "SUMMARIZE_SPOKEN_TEXT", "MCM_LISTENING", "FIB_LISTENING", "MCS_LISTENING", "SELECT_MISSING_WORD", "HIGHLIGHT_INCORRECT_WORDS", "WRITE_FROM_DICTATION"],
};

export interface WeightRow {
  questionType: QuestionType;
  skill: Skill;
  weightPct: number;
}

/** The derived model, docs/02-scoring-spec.md §10 — seed data for `skill_weights`. */
export const DERIVED_WEIGHT_ROWS: readonly WeightRow[] = [
  // Speaking
  { skill: "speaking", questionType: "REPEAT_SENTENCE", weightPct: 42.4 },
  { skill: "speaking", questionType: "READ_ALOUD", weightPct: 28.9 },
  { skill: "speaking", questionType: "DESCRIBE_IMAGE", weightPct: 15.6 },
  { skill: "speaking", questionType: "RESPOND_TO_SITUATION", weightPct: 11.6 },
  { skill: "speaking", questionType: "ANSWER_SHORT_QUESTION", weightPct: 1.6 },
  // Reading
  { skill: "reading", questionType: "READ_ALOUD", weightPct: 30.4 },
  { skill: "reading", questionType: "FIB_RW", weightPct: 25.8 },
  { skill: "reading", questionType: "FIB_READING", weightPct: 21.1 },
  { skill: "reading", questionType: "REORDER_PARAGRAPH", weightPct: 9.4 },
  { skill: "reading", questionType: "SUMMARIZE_WRITTEN_TEXT", weightPct: 5.6 },
  { skill: "reading", questionType: "MCM_READING", weightPct: 3.5 },
  { skill: "reading", questionType: "HIGHLIGHT_INCORRECT_WORDS", weightPct: 2.8 },
  { skill: "reading", questionType: "MCS_READING", weightPct: 1.4 },
  // Writing
  { skill: "writing", questionType: "WRITE_EMAIL", weightPct: 26.6 },
  { skill: "writing", questionType: "WRITE_FROM_DICTATION", weightPct: 22.3 },
  { skill: "writing", questionType: "FIB_RW", weightPct: 19.5 },
  { skill: "writing", questionType: "FIB_LISTENING", weightPct: 12.4 },
  { skill: "writing", questionType: "SUMMARIZE_SPOKEN_TEXT", weightPct: 10.6 },
  { skill: "writing", questionType: "SUMMARIZE_WRITTEN_TEXT", weightPct: 8.5 },
  // Listening
  { skill: "listening", questionType: "REPEAT_SENTENCE", weightPct: 30.6 },
  { skill: "listening", questionType: "WRITE_FROM_DICTATION", weightPct: 29.2 },
  { skill: "listening", questionType: "FIB_LISTENING", weightPct: 16.2 },
  { skill: "listening", questionType: "SUMMARIZE_SPOKEN_TEXT", weightPct: 7.0 },
  { skill: "listening", questionType: "HIGHLIGHT_INCORRECT_WORDS", weightPct: 5.6 },
  { skill: "listening", questionType: "ANSWER_SHORT_QUESTION", weightPct: 5.1 },
  { skill: "listening", questionType: "MCM_LISTENING", weightPct: 3.5 },
  { skill: "listening", questionType: "MCS_LISTENING", weightPct: 1.4 },
  { skill: "listening", questionType: "SELECT_MISSING_WORD", weightPct: 1.4 },
];

/** "25.8%". Always one decimal, as the derivation is only that precise. */
export function formatWeight(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export interface WeightEntry {
  questionType: QuestionType;
  weightPct: number;
  /** Pearson's published questions per test, e.g. "6–7". */
  officialCount: string;
}

/** Each skill's tasks in the official task order, with the weight and official count. Tasks with no weight row are left out. */
export function groupWeights(rows: readonly WeightRow[]): Record<Skill, WeightEntry[]> {
  const result = { speaking: [], writing: [], reading: [], listening: [] } as Record<Skill, WeightEntry[]>;
  for (const skill of SKILL_ORDER) {
    const bySkill = new Map(rows.filter((r) => r.skill === skill).map((r) => [r.questionType, r.weightPct]));
    const ordered = TASK_ORDER[skill].flatMap((type) => {
      const pct = bySkill.get(type);
      return pct === undefined ? [] : [{ questionType: type, weightPct: pct, officialCount: OFFICIAL_QUESTION_COUNTS[type] }];
    });
    // Anything not in the fixed order still shows, after it.
    const extras = [...bySkill]
      .filter(([type]) => !TASK_ORDER[skill].includes(type))
      .map(([type, pct]) => ({ questionType: type, weightPct: pct, officialCount: OFFICIAL_QUESTION_COUNTS[type] }));
    result[skill] = [...ordered, ...extras];
  }
  return result;
}

/** A type's contribution to each skill it feeds, in skill order. */
export function weightsForType(
  rows: readonly WeightRow[],
  type: QuestionType,
): { skill: Skill; weightPct: number }[] {
  return SKILL_ORDER.flatMap((skill) => {
    const row = rows.find((r) => r.questionType === type && r.skill === skill);
    return row ? [{ skill, weightPct: row.weightPct }] : [];
  });
}

/** "19.5% of Writing · 25.8% of Reading", or null if the type has no weights. */
export function weightSummary(rows: readonly WeightRow[], type: QuestionType): string | null {
  const parts = weightsForType(rows, type).map((w) => `${formatWeight(w.weightPct)} of ${SKILL_LABELS[w.skill]}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
