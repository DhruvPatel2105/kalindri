/**
 * WRITE_EMAIL — docs/01-question-types.md §7.
 *
 * Note: this type's content checklist is named `bullet_points` (exactly 3) in
 * the spec, not `key_points` — kept as documented rather than renamed, per
 * "do not invent fields."
 */

import { z } from "zod";

import { registerSchema } from "./shared";

export const writeEmailSchema = z.object({
  scenario: z.string().min(1),
  bullet_points: z.array(z.string().min(1)).length(3),
  recipient: z.string().min(1),
  register: registerSchema,
  model_answer: z.string().min(1),
  time_limit_seconds: z.number().int().positive().default(540),
});

export type WriteEmailPayload = z.infer<typeof writeEmailSchema>;
