/**
 * REORDER_PARAGRAPH — docs/01-question-types.md §10.
 * `boxes` is the correct order; scoring counts adjacent pairs (N boxes → max
 * N-1), not positions — that logic belongs to the scorer, not this schema.
 */

import { z } from "zod";

export const reorderParagraphSchema = z.object({
  boxes: z.array(z.string().min(1)).min(2),
});

export type ReorderParagraphPayload = z.infer<typeof reorderParagraphSchema>;
