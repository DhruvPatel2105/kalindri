/**
 * Suggested pace per question and a time formatter. Pure — no database or
 * browser — so every rule is unit-tested.
 *
 * The pace figures are a PRACTICE GUIDE (how long to aim to spend on one
 * question of the type), taken from common preparation guidance. They are not
 * official Pearson limits and are always shown as "suggested pace". The only
 * hard time limits in the real test are the per-task timers on the two
 * written tasks, which docs/01-question-types.md records (10 and 9 minutes).
 */

import type { QuestionType } from "@/lib/questions/types";

export interface SuggestedPace {
  /** Aim to finish within this many seconds. */
  limit: number;
  /** How it reads on screen, e.g. "1–1.5 min". */
  label: string;
}

const PACE: Partial<Record<QuestionType, SuggestedPace>> = {
  // Reading
  FIB_RW: { limit: 120, label: "up to 2 min" },
  MCM_READING: { limit: 90, label: "1–1.5 min" },
  REORDER_PARAGRAPH: { limit: 120, label: "1.5–2 min" },
  FIB_READING: { limit: 120, label: "up to 2 min" },
  MCS_READING: { limit: 90, label: "1–1.5 min" },
  // Listening
  MCM_LISTENING: { limit: 90, label: "1–1.5 min" },
  FIB_LISTENING: { limit: 120, label: "up to 2 min" },
  MCS_LISTENING: { limit: 90, label: "1–1.5 min" },
  SELECT_MISSING_WORD: { limit: 90, label: "1–1.5 min" },
  HIGHLIGHT_INCORRECT_WORDS: { limit: 120, label: "up to 2 min" },
  WRITE_FROM_DICTATION: { limit: 120, label: "2 min" },
  // Written tasks with their own timers
  SUMMARIZE_WRITTEN_TEXT: { limit: 600, label: "10 min (task timer)" },
  WRITE_EMAIL: { limit: 540, label: "9 min (task timer)" },
  SUMMARIZE_SPOKEN_TEXT: { limit: 480, label: "8 min (task timer)" },
};

/** The suggested pace for a type; null for the speaking types, which the app times itself. */
export function suggestedPace(type: QuestionType): SuggestedPace | null {
  return PACE[type] ?? null;
}

/** "1m 20s" / "45s" / "2m". */
export function formatSeconds(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}
