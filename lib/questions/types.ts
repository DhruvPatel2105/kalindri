/**
 * The question-type union and its two structural mappings (test part, scored
 * skills). Both are `satisfies Record<QuestionType, ...>`, so adding a value to
 * the Drizzle `question_type` enum without extending these two maps is a
 * compile error — they cannot drift apart from the enum, and cannot drift from
 * each other either.
 *
 * Source: docs/01-question-types.md (the "Skills:" line and Part heading on
 * each type) and CLAUDE.md's question-type list.
 */

import { questionType, skill } from "@/lib/db/schema";

export const QUESTION_TYPES = questionType.enumValues;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const SKILLS = skill.enumValues;
export type Skill = (typeof SKILLS)[number];

export type TestPart = 1 | 2 | 3;

/** Part 1 = Speaking & Writing · Part 2 = Reading · Part 3 = Listening. */
export const PART_BY_TYPE = {
  READ_ALOUD: 1,
  REPEAT_SENTENCE: 1,
  DESCRIBE_IMAGE: 1,
  RESPOND_TO_SITUATION: 1,
  ANSWER_SHORT_QUESTION: 1,
  SUMMARIZE_WRITTEN_TEXT: 1,
  WRITE_EMAIL: 1,

  FIB_RW: 2,
  MCM_READING: 2,
  REORDER_PARAGRAPH: 2,
  FIB_READING: 2,
  MCS_READING: 2,

  SUMMARIZE_SPOKEN_TEXT: 3,
  MCM_LISTENING: 3,
  FIB_LISTENING: 3,
  MCS_LISTENING: 3,
  SELECT_MISSING_WORD: 3,
  HIGHLIGHT_INCORRECT_WORDS: 3,
  WRITE_FROM_DICTATION: 3,
} satisfies Record<QuestionType, TestPart>;

/**
 * Which skill(s) each type's score feeds into. Read Aloud is the documented
 * Core-only exception: it scores into BOTH Reading and Speaking (PTE Academic
 * dropped the Reading contribution in Aug 2025 — that does not apply to Core).
 */
export const SKILLS_BY_TYPE = {
  READ_ALOUD: ["reading", "speaking"],
  REPEAT_SENTENCE: ["listening", "speaking"],
  DESCRIBE_IMAGE: ["speaking"],
  RESPOND_TO_SITUATION: ["speaking"],
  ANSWER_SHORT_QUESTION: ["listening", "speaking"],
  SUMMARIZE_WRITTEN_TEXT: ["reading", "writing"],
  WRITE_EMAIL: ["writing"],

  FIB_RW: ["reading", "writing"],
  MCM_READING: ["reading"],
  REORDER_PARAGRAPH: ["reading"],
  FIB_READING: ["reading"],
  MCS_READING: ["reading"],

  SUMMARIZE_SPOKEN_TEXT: ["listening", "writing"],
  MCM_LISTENING: ["listening"],
  FIB_LISTENING: ["listening", "writing"],
  MCS_LISTENING: ["listening"],
  SELECT_MISSING_WORD: ["listening"],
  HIGHLIGHT_INCORRECT_WORDS: ["listening", "reading"],
  WRITE_FROM_DICTATION: ["listening", "writing"],
} satisfies Record<QuestionType, readonly Skill[]>;
