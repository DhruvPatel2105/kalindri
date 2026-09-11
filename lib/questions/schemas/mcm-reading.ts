/**
 * MCM_READING — Multiple Choice, Multiple Answers (Reading).
 * docs/01-question-types.md §9. Negative marking happens at scoring time, not
 * here — this only validates the payload shape.
 */

import { z } from "zod";

import { mcqOptionSchema, refineMultipleCorrectOptions } from "./shared";

export const mcmReadingSchema = z
  .object({
    passage: z.string().min(1),
    question: z.string().min(1),
    options: z.array(mcqOptionSchema).min(2),
    correct_option_ids: z.array(z.string().min(1)).min(1),
  })
  .superRefine(refineMultipleCorrectOptions);

export type McmReadingPayload = z.infer<typeof mcmReadingSchema>;
