/**
 * REPEAT_SENTENCE — docs/01-question-types.md §2.
 * `sentence_text` drives the generated audio AND the answer key.
 */

import { z } from "zod";

import { accentSchema, wordCount } from "./shared";

export const repeatSentenceSchema = z.object({
  sentence_text: z
    .string()
    .min(1)
    .refine((value) => {
      const words = wordCount(value);
      return words >= 8 && words <= 12;
    }, "sentence_text must be 8-12 words"),
  audio_url: z.string().url(),
  accent: accentSchema,
  record_seconds: z.number().int().positive().default(15),
});

export type RepeatSentencePayload = z.infer<typeof repeatSentenceSchema>;
