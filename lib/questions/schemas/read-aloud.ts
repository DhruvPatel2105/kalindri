/**
 * READ_ALOUD — docs/01-question-types.md §1.
 * Content is scored by word-level diff against `text` itself; no key_points.
 */

import { z } from "zod";

import { difficultySchema, wordCount } from "./shared";

export const readAloudSchema = z.object({
  text: z
    .string()
    .min(1)
    .refine((value) => {
      const words = wordCount(value);
      return words >= 50 && words <= 70;
    }, "text must be 50-70 words"),
  prep_seconds: z.number().int().positive().default(35),
  record_seconds: z.number().int().positive().default(40),
  model_audio_url: z.string().url(),
  difficulty: difficultySchema,
});

export type ReadAloudPayload = z.infer<typeof readAloudSchema>;
