/**
 * Pure helpers for a practice-TEST session's `sessions.state` — the
 * multi-question counterpart of sessionState.ts. No DB access here.
 *
 *   state = {
 *     snapshots: [{ id, type, payload }, ...]   // in question order, frozen at start
 *     answers:   { [questionId]: response }      // autosaved drafts
 *   }
 *
 * Snapshots are taken once, when the test starts, and grading only ever reads
 * them — so editing a question mid-test or afterwards can't change how an
 * attempt is marked (CLAUDE.md #9). `answers` holds the student's draft
 * responses, written as they move between questions so a closed tab loses
 * nothing (docs/03-data-model.md: "autosaved; survives browser crash").
 */

import { z } from "zod";

import type { QuestionType } from "@/lib/questions/types";

export interface QuestionSnapshot {
  id: string;
  type: QuestionType;
  payload: unknown;
}

export interface TestState {
  snapshots: QuestionSnapshot[];
  answers: Record<string, unknown>;
}

const testStateSchema = z.object({
  snapshots: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      payload: z.unknown(),
    }),
  ),
  answers: z.record(z.string(), z.unknown()).default({}),
});

export function buildTestState(snapshots: QuestionSnapshot[]): TestState {
  return { snapshots, answers: {} };
}

/** Never throws: a missing or malformed state (nothing else writes it) is null. */
export function extractTestState(state: unknown): TestState | null {
  const parsed = testStateSchema.safeParse(state);
  if (!parsed.success) return null;
  return {
    snapshots: parsed.data.snapshots.map((s) => ({
      id: s.id,
      // Trusted: only lib/practice/testEngine.ts writes this, with real enum values.
      type: s.type as QuestionType,
      payload: s.payload,
    })),
    answers: parsed.data.answers,
  };
}

/**
 * Whether a response counts as an answer. A blank string, an empty array, or
 * an array of only blank strings is "unanswered" — e.g. a fill-in-the-blanks
 * response is `["", "", ""]` until the student fills something in.
 */
export function isAnswered(response: unknown): boolean {
  if (typeof response === "string") return response.trim().length > 0;
  if (Array.isArray(response)) {
    return response.some((item) =>
      typeof item === "string" ? item.trim().length > 0 : item != null,
    );
  }
  return false;
}

export type AnswerStatus = "answered" | "unanswered";

/** One status per question, in test order — drives the navigation panel. */
export function answerStatuses(
  questionIds: readonly string[],
  answers: Record<string, unknown>,
): AnswerStatus[] {
  return questionIds.map((id) =>
    isAnswered(answers[id]) ? "answered" : "unanswered",
  );
}

export function countAnswered(
  questionIds: readonly string[],
  answers: Record<string, unknown>,
): number {
  return answerStatuses(questionIds, answers).filter((s) => s === "answered")
    .length;
}

/** The "nothing answered" response for a type — a string for the single-choice-style types, else an empty array. */
export function emptyResponseFor(type: QuestionType): string | never[] {
  switch (type) {
    case "MCS_READING":
    case "MCS_LISTENING":
    case "SELECT_MISSING_WORD":
    case "WRITE_FROM_DICTATION":
      return "";
    default:
      return [];
  }
}

/** A saved question index kept inside 0..count-1 (a stale or tampered value can't break the runner). */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isInteger(index)) return 0;
  return Math.min(Math.max(0, index), count - 1);
}

/** "12m 05s" / "1h 02m" / "45s". Negative or invalid input is 0s. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
