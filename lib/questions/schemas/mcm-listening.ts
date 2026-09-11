/**
 * MCM_LISTENING — Multiple Choice, Multiple Answers (Listening).
 * docs/01-question-types.md §14.
 *
 * NOTE: the spec gives no payload block for this type — only "+1 correct, -1
 * incorrect, floored at 0." The shape below is not invented: it combines
 * MCM_READING's documented MCQ fields (question, options, correct_option_ids)
 * with the transcript/audio_url/accent vocabulary the spec uses for every
 * other Listening type. Flagged for confirmation against the real spec.
 */

import { z } from "zod";

import {
  accentSchema,
  mcqOptionSchema,
  refineMultipleCorrectOptions,
} from "./shared";

export const mcmListeningSchema = z
  .object({
    transcript: z.string().min(1),
    audio_url: z.string().url(),
    accent: accentSchema,
    question: z.string().min(1),
    options: z.array(mcqOptionSchema).min(2),
    correct_option_ids: z.array(z.string().min(1)).min(1),
  })
  .superRefine(refineMultipleCorrectOptions);

export type McmListeningPayload = z.infer<typeof mcmListeningSchema>;
