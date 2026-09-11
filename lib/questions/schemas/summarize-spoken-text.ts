/**
 * SUMMARIZE_SPOKEN_TEXT — docs/01-question-types.md §13.
 * `transcript` drives the generated audio AND the key points; spec gives
 * duration (60-90s of speech), not a word count, so no length refinement.
 */

import { z } from "zod";

import { accentSchema } from "./shared";

export const summarizeSpokenTextSchema = z.object({
  transcript: z.string().min(1),
  audio_url: z.string().url(),
  accent: accentSchema,
  key_points: z.array(z.string().min(1)).min(1),
  model_answer: z.string().min(1),
  time_limit_seconds: z.number().int().positive().default(600),
});

export type SummarizeSpokenTextPayload = z.infer<
  typeof summarizeSpokenTextSchema
>;
