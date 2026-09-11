/**
 * WRITE_FROM_DICTATION — docs/01-question-types.md §19.
 * `sentence_text` is the question, the audio source AND the answer key.
 */

import { z } from "zod";

import { accentSchema, wordCount } from "./shared";

export const writeFromDictationSchema = z.object({
  sentence_text: z
    .string()
    .min(1)
    .refine((value) => {
      const words = wordCount(value);
      return words >= 8 && words <= 12;
    }, "sentence_text must be 8-12 words"),
  audio_url: z.string().url(),
  accent: accentSchema,
});

export type WriteFromDictationPayload = z.infer<
  typeof writeFromDictationSchema
>;
