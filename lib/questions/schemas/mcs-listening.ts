/**
 * MCS_LISTENING — Multiple Choice, Single Answer (Listening).
 * docs/01-question-types.md §16.
 *
 * NOTE: the spec gives no payload block for this type — only "Correct/
 * incorrect · ~1% of Listening." Derived the same way as MCS_READING and
 * MCM_LISTENING: MCM_LISTENING's fields with the single/multiple distinction
 * applied (`correct_option_ids[]` → `correct_option_id`). Flagged for
 * confirmation against the real spec.
 */

import { z } from "zod";

import {
  accentSchema,
  mcqOptionSchema,
  refineSingleCorrectOption,
} from "./shared";

export const mcsListeningSchema = z
  .object({
    transcript: z.string().min(1),
    audio_url: z.string().url(),
    accent: accentSchema,
    question: z.string().min(1),
    options: z.array(mcqOptionSchema).min(2),
    correct_option_id: z.string().min(1),
  })
  .superRefine(refineSingleCorrectOption);

export type McsListeningPayload = z.infer<typeof mcsListeningSchema>;
