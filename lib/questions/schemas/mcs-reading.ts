/**
 * MCS_READING — Multiple Choice, Single Answer (Reading).
 * docs/01-question-types.md §12.
 *
 * NOTE: the spec gives no payload block for this type — only "Correct/
 * incorrect · Worth ~1% of Reading." The shape below is not invented: it is
 * MCM_READING's documented payload (passage, question, options,
 * correct_option_id(s)) with the single/multiple distinction the doc already
 * draws between the two MCQ variants applied — `correct_option_ids[]` becomes
 * singular `correct_option_id`. Flagged for confirmation against the real spec.
 */

import { z } from "zod";

import { mcqOptionSchema, refineSingleCorrectOption } from "./shared";

export const mcsReadingSchema = z
  .object({
    passage: z.string().min(1),
    question: z.string().min(1),
    options: z.array(mcqOptionSchema).min(2),
    correct_option_id: z.string().min(1),
  })
  .superRefine(refineSingleCorrectOption);

export type McsReadingPayload = z.infer<typeof mcsReadingSchema>;
