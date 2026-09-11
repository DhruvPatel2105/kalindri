/**
 * SUMMARIZE_WRITTEN_TEXT — docs/01-question-types.md §6. No spelling trait.
 */

import { z } from "zod";

import { wordCount } from "./shared";

export const summarizeWrittenTextSchema = z.object({
  passage: z
    .string()
    .min(1)
    .refine((value) => {
      const words = wordCount(value);
      return words >= 200 && words <= 300;
    }, "passage must be 200-300 words"),
  key_points: z.array(z.string().min(1)).min(1),
  model_answer: z.string().min(1),
  time_limit_seconds: z.number().int().positive().default(600),
});

export type SummarizeWrittenTextPayload = z.infer<
  typeof summarizeWrittenTextSchema
>;
