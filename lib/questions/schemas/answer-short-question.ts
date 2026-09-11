/**
 * ANSWER_SHORT_QUESTION — docs/01-question-types.md §5.
 * Scored from a speech transcript; `accepted_answers` is the un-normalised
 * answer key (normalisation happens at scoring time, not here).
 */

import { z } from "zod";

export const answerShortQuestionSchema = z.object({
  question_text: z.string().min(1),
  audio_url: z.string().url(),
  accepted_answers: z.array(z.string().min(1)).min(1),
  record_seconds: z.number().int().positive().default(10),
});

export type AnswerShortQuestionPayload = z.infer<
  typeof answerShortQuestionSchema
>;
