/**
 * HIGHLIGHT_INCORRECT_WORDS — docs/01-question-types.md §18.
 * `true_transcript` generates the audio; `altered_transcript` is what's shown
 * on screen, with mismatches at `altered_word_indices`.
 */

import { z } from "zod";

export const highlightIncorrectWordsSchema = z.object({
  true_transcript: z.string().min(1),
  altered_transcript: z.string().min(1),
  altered_word_indices: z.array(z.number().int().nonnegative()).min(1),
});

export type HighlightIncorrectWordsPayload = z.infer<
  typeof highlightIncorrectWordsSchema
>;
