import type { QuestionType } from "./types";

/** Display names for all 19 PTE Core question types. Within a skill column the context disambiguates (e.g. both Reading and Listening have a Multiple Choice (Multiple)). */
export const QUESTION_TYPE_LABELS = {
  READ_ALOUD: "Read Aloud",
  REPEAT_SENTENCE: "Repeat Sentence",
  DESCRIBE_IMAGE: "Describe Image",
  RESPOND_TO_SITUATION: "Respond to a Situation",
  ANSWER_SHORT_QUESTION: "Answer Short Question",
  SUMMARIZE_WRITTEN_TEXT: "Summarize Written Text",
  WRITE_EMAIL: "Write Email",
  FIB_RW: "R&W Fill in the Blanks",
  MCM_READING: "Multiple Choice (Multiple)",
  REORDER_PARAGRAPH: "Reorder Paragraph",
  FIB_READING: "Reading Fill in the Blanks",
  MCS_READING: "Multiple Choice (Single)",
  SUMMARIZE_SPOKEN_TEXT: "Summarize Spoken Text",
  MCM_LISTENING: "Multiple Choice (Multiple)",
  FIB_LISTENING: "Listening Fill in the Blanks",
  MCS_LISTENING: "Multiple Choice (Single)",
  SELECT_MISSING_WORD: "Select Missing Word",
  HIGHLIGHT_INCORRECT_WORDS: "Highlight Incorrect Words",
  WRITE_FROM_DICTATION: "Write from Dictation",
} satisfies Record<QuestionType, string>;

/**
 * Questions per test, as published by Pearson (PTE Core Test Taker Score
 * Guide, via docs/01-question-types.md). Counts, not weights: these ARE
 * official figures.
 */
export const OFFICIAL_QUESTION_COUNTS = {
  READ_ALOUD: "6–7",
  REPEAT_SENTENCE: "10–12",
  DESCRIBE_IMAGE: "3–4",
  RESPOND_TO_SITUATION: "2–4",
  ANSWER_SHORT_QUESTION: "5–6",
  SUMMARIZE_WRITTEN_TEXT: "1–2",
  WRITE_EMAIL: "2–3",
  FIB_RW: "5–6",
  MCM_READING: "1–2",
  REORDER_PARAGRAPH: "2–3",
  FIB_READING: "4–5",
  MCS_READING: "1–2",
  SUMMARIZE_SPOKEN_TEXT: "1–2",
  MCM_LISTENING: "1–2",
  FIB_LISTENING: "2–3",
  MCS_LISTENING: "1–2",
  SELECT_MISSING_WORD: "1–2",
  HIGHLIGHT_INCORRECT_WORDS: "1–2",
  WRITE_FROM_DICTATION: "3–4",
} satisfies Record<QuestionType, string>;
