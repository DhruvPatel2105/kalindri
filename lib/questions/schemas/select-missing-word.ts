/**
 * SELECT_MISSING_WORD — docs/01-question-types.md §17.
 * Audio ends with a beep replacing the final word(s); the beep is appended
 * programmatically, not stored here.
 */

import { z } from "zod";

import { mcqOptionSchema, refineSingleCorrectOption } from "./shared";

export const selectMissingWordSchema = z
  .object({
    transcript: z.string().min(1),
    missing_word_position: z.number().int().nonnegative(),
    options: z.array(mcqOptionSchema).min(2),
    correct_option_id: z.string().min(1),
  })
  .superRefine(refineSingleCorrectOption);

export type SelectMissingWordPayload = z.infer<
  typeof selectMissingWordSchema
>;
