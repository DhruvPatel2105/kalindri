/**
 * Pure read/write helpers for `sessions.state` — the ONE question's payload
 * exactly as it existed when startSession.ts created the session. Stored
 * there (not re-fetched from `questions` later) so a later edit to the
 * question can never change what submitAttempt.ts grades an attempt
 * against. No DB access in this file — startSession.ts writes via
 * `buildSessionState`, submitAttempt.ts reads via `extractQuestionSnapshot`.
 */

import { z } from "zod";

import type { QuestionType } from "@/lib/questions/types";

export interface QuestionSnapshot {
  id: string;
  type: QuestionType;
  payload: unknown;
}

const sessionStateSchema = z.object({
  questionSnapshot: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    payload: z.unknown(),
  }),
});

/** The `sessions.state` value startSession.ts persists at session start. */
export function buildSessionState(snapshot: QuestionSnapshot): {
  questionSnapshot: QuestionSnapshot;
} {
  return { questionSnapshot: snapshot };
}

/**
 * Reads back the snapshot `buildSessionState` wrote. Never throws — a
 * missing or malformed `state` (there's no other writer, but defend anyway)
 * returns null rather than crashing the caller.
 */
export function extractQuestionSnapshot(state: unknown): QuestionSnapshot | null {
  const parsed = sessionStateSchema.safeParse(state);
  if (!parsed.success) return null;

  const { questionSnapshot } = parsed.data;
  return {
    id: questionSnapshot.id,
    // Trusted: startSession.ts is the only writer of sessions.state, and it
    // always writes a real QuestionType enum value here.
    type: questionSnapshot.type as QuestionType,
    payload: questionSnapshot.payload,
  };
}
