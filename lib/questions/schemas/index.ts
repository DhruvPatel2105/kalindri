/**
 * The schema registry: one Zod schema per QuestionType, keyed by the type
 * itself. `satisfies Record<QuestionType, z.ZodTypeAny>` makes a missing or
 * extra key a compile error; the registry test in `registry.test.ts` asserts
 * the same thing at runtime so it fails even if someone routes around the
 * type check (e.g. with `as`).
 */

import type { z } from "zod";

import type { QuestionType } from "@/lib/questions/types";

import { answerShortQuestionSchema } from "./answer-short-question";
import { describeImageSchema } from "./describe-image";
import { fibListeningSchema } from "./fib-listening";
import { fibReadingSchema } from "./fib-reading";
import { fibRwSchema } from "./fib-rw";
import { highlightIncorrectWordsSchema } from "./highlight-incorrect-words";
import { mcmListeningSchema } from "./mcm-listening";
import { mcmReadingSchema } from "./mcm-reading";
import { mcsListeningSchema } from "./mcs-listening";
import { mcsReadingSchema } from "./mcs-reading";
import { readAloudSchema } from "./read-aloud";
import { reorderParagraphSchema } from "./reorder-paragraph";
import { repeatSentenceSchema } from "./repeat-sentence";
import { respondToSituationSchema } from "./respond-to-situation";
import { selectMissingWordSchema } from "./select-missing-word";
import { summarizeSpokenTextSchema } from "./summarize-spoken-text";
import { summarizeWrittenTextSchema } from "./summarize-written-text";
import { writeEmailSchema } from "./write-email";
import { writeFromDictationSchema } from "./write-from-dictation";

export const questionSchemas = {
  READ_ALOUD: readAloudSchema,
  REPEAT_SENTENCE: repeatSentenceSchema,
  DESCRIBE_IMAGE: describeImageSchema,
  RESPOND_TO_SITUATION: respondToSituationSchema,
  ANSWER_SHORT_QUESTION: answerShortQuestionSchema,
  SUMMARIZE_WRITTEN_TEXT: summarizeWrittenTextSchema,
  WRITE_EMAIL: writeEmailSchema,

  FIB_RW: fibRwSchema,
  MCM_READING: mcmReadingSchema,
  REORDER_PARAGRAPH: reorderParagraphSchema,
  FIB_READING: fibReadingSchema,
  MCS_READING: mcsReadingSchema,

  SUMMARIZE_SPOKEN_TEXT: summarizeSpokenTextSchema,
  MCM_LISTENING: mcmListeningSchema,
  FIB_LISTENING: fibListeningSchema,
  MCS_LISTENING: mcsListeningSchema,
  SELECT_MISSING_WORD: selectMissingWordSchema,
  HIGHLIGHT_INCORRECT_WORDS: highlightIncorrectWordsSchema,
  WRITE_FROM_DICTATION: writeFromDictationSchema,
} satisfies Record<QuestionType, z.ZodTypeAny>;

export type QuestionSchemaRegistry = typeof questionSchemas;

export * from "./answer-short-question";
export * from "./describe-image";
export * from "./fib-listening";
export * from "./fib-reading";
export * from "./fib-rw";
export * from "./highlight-incorrect-words";
export * from "./mcm-listening";
export * from "./mcm-reading";
export * from "./mcs-listening";
export * from "./mcs-reading";
export * from "./read-aloud";
export * from "./reorder-paragraph";
export * from "./repeat-sentence";
export * from "./respond-to-situation";
export * from "./select-missing-word";
export * from "./shared";
export * from "./summarize-spoken-text";
export * from "./summarize-written-text";
export * from "./write-email";
export * from "./write-from-dictation";
