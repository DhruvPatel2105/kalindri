/**
 * Validates the STUDENT'S RESPONSE shape per deterministic question type —
 * distinct from lib/questions/schemas' payload schemas, which validate the
 * QUESTION, not the answer. Shapes mirror lib/scoring/registry.ts's
 * `DeterministicResponseByType` exactly (verified there, not assumed).
 *
 * No minimum-length constraints on purpose: an empty/incomplete answer
 * (blank string, empty array) is a legitimate submission — the deterministic
 * scorers already handle it, typically scoring 0 — so only the SHAPE is
 * rejected here as malformed, never mere incompleteness.
 *
 * llm/speech types have no response schema yet (out of scope this session —
 * see submitAttempt.ts); this file only covers the 11 deterministic types.
 */

import { z } from "zod";

import type { DeterministicQuestionType } from "@/lib/scoring/registry";

export const responseSchemas = {
  FIB_RW: z.array(z.string()),
  MCM_READING: z.array(z.string()),
  REORDER_PARAGRAPH: z.array(z.string()),
  FIB_READING: z.array(z.string()),
  MCS_READING: z.string(),
  MCM_LISTENING: z.array(z.string()),
  FIB_LISTENING: z.array(z.string()),
  MCS_LISTENING: z.string(),
  SELECT_MISSING_WORD: z.string(),
  HIGHLIGHT_INCORRECT_WORDS: z.array(z.number().int().nonnegative()),
  WRITE_FROM_DICTATION: z.string(),
} satisfies Record<DeterministicQuestionType, z.ZodTypeAny>;

export type ValidateResponseResult<T extends DeterministicQuestionType> =
  | { success: true; data: z.infer<(typeof responseSchemas)[T]> }
  | { success: false; error: string };

/** Reject malformed input before touching the database — CLAUDE.md. */
export function validateDeterministicResponse<
  T extends DeterministicQuestionType,
>(type: T, response: unknown): ValidateResponseResult<T> {
  const schema = responseSchemas[type];
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { success: true, data: parsed.data };
}
