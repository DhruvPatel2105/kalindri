/**
 * FIB_LISTENING — Fill in the Blanks (Listening). docs/01-question-types.md
 * §15. Typed, not dropdown — spelling counts at scoring time.
 */

import { z } from "zod";

export const fibListeningSchema = z.object({
  transcript: z.string().min(1),
  audio_url: z.string().url(),
  blank_word_indices: z.array(z.number().int().nonnegative()).min(1),
});

export type FibListeningPayload = z.infer<typeof fibListeningSchema>;
