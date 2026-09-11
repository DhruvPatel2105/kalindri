/**
 * RESPOND_TO_SITUATION — docs/01-question-types.md §4.
 */

import { z } from "zod";

import { registerSchema } from "./shared";

export const respondToSituationSchema = z.object({
  situation_text: z.string().min(1),
  audio_url: z.string().url(),
  register: registerSchema,
  key_points: z.array(z.string().min(1)).min(1),
  model_answer: z.string().min(1),
  prep_seconds: z.number().int().positive().default(20),
  record_seconds: z.number().int().positive().default(40),
});

export type RespondToSituationPayload = z.infer<
  typeof respondToSituationSchema
>;
