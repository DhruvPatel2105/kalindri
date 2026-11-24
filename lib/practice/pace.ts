/**
 * Suggested pace per question, and the time analysis of a finished test. Pure
 * — no database or browser — so every rule is unit-tested.
 *
 * The pace figures are a PRACTICE GUIDE (how long to aim to spend on one
 * question of the type), taken from common preparation guidance. They are not
 * official Pearson limits and are always shown as "suggested pace". The only
 * hard time limits in the real test are the per-task timers on the two
 * written tasks, which docs/01-question-types.md records (10 and 9 minutes).
 */

import type { QuestionType } from "@/lib/questions/types";

import type { QuestionResultKind } from "./testResults";

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

export type PaceStatus = "within" | "over";

export interface TimedQuestion {
  /** 0-based position in the test. */
  index: number;
  seconds: number | null;
  /** null while the answer has no mark yet. */
  kind: QuestionResultKind | null;
}

export interface TimingRow {
  index: number;
  seconds: number;
  kind: QuestionResultKind | null;
  status: PaceStatus | null;
}

export interface TimingAnalysis {
  /** Total active time, seconds. */
  totalSeconds: number;
  /** Questions that have a recorded time. */
  timedQuestions: number;
  averageSeconds: number;
  pace: SuggestedPace | null;
  /** Questions within / over the suggested pace (0/0 when the type has none). */
  withinPace: number;
  overPace: number;
  /** Average time on fully correct answers vs the rest, only when both groups exist. */
  averageCorrectSeconds: number | null;
  averageMissedSeconds: number | null;
  slowest: { index: number; seconds: number } | null;
  /** Answered wrongly in under a quarter of the suggested pace — likely rushed. */
  rushedMisses: number[];
  rows: TimingRow[];
  /** Plain statements specific to THIS test, in the order worth reading them. */
  insights: string[];
}

const RUSH_FRACTION = 0.25;

/**
 * Turns the per-question times and marks of a finished test into the figures
 * and observations the results page shows. Returns null when no question has a
 * recorded time (a test taken before timing existed).
 */
export function analyzeTiming(type: QuestionType, questions: readonly TimedQuestion[]): TimingAnalysis | null {
  const timed = questions.filter((q): q is TimedQuestion & { seconds: number } => q.seconds !== null && q.seconds > 0);
  if (timed.length === 0) return null;

  const pace = suggestedPace(type);
  const total = timed.reduce((sum, q) => sum + q.seconds, 0);
  const average = Math.round(total / timed.length);
  const statusOf = (seconds: number): PaceStatus | null => (pace ? (seconds <= pace.limit ? "within" : "over") : null);

  const rows: TimingRow[] = timed.map((q) => ({ index: q.index, seconds: q.seconds, kind: q.kind, status: statusOf(q.seconds) }));
  const withinPace = rows.filter((r) => r.status === "within").length;
  const overPace = rows.filter((r) => r.status === "over").length;

  const mean = (values: number[]): number | null =>
    values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const correct = timed.filter((q) => q.kind === "correct").map((q) => q.seconds);
  const missed = timed.filter((q) => q.kind === "partial" || q.kind === "incorrect").map((q) => q.seconds);
  const averageCorrectSeconds = correct.length > 0 && missed.length > 0 ? mean(correct) : null;
  const averageMissedSeconds = correct.length > 0 && missed.length > 0 ? mean(missed) : null;

  const slowestRow = rows.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const rushedMisses = pace
    ? timed
        .filter((q) => (q.kind === "incorrect" || q.kind === "partial") && q.seconds < pace.limit * RUSH_FRACTION)
        .map((q) => q.index)
    : [];

  const insights: string[] = [];
  if (pace) {
    insights.push(
      overPace === 0
        ? `Every question was within the suggested pace (${pace.label}); you averaged ${formatSeconds(average)}.`
        : `You averaged ${formatSeconds(average)} per question against a suggested pace of ${pace.label}, and ${overPace} of ${timed.length} ${overPace === 1 ? "question was" : "questions were"} over it.`,
    );
    if (overPace > 0 && slowestRow.seconds > pace.limit) {
      insights.push(
        `Question ${slowestRow.index + 1} took longest at ${formatSeconds(slowestRow.seconds)} — ${formatSeconds(slowestRow.seconds - pace.limit)} over the suggested pace.`,
      );
    }
  } else {
    insights.push(`You averaged ${formatSeconds(average)} per question.`);
  }
  if (averageCorrectSeconds !== null && averageMissedSeconds !== null) {
    insights.push(
      averageMissedSeconds > averageCorrectSeconds * 1.25
        ? `You spent more time on the questions you missed (${formatSeconds(averageMissedSeconds)} on average) than on the ones you got right (${formatSeconds(averageCorrectSeconds)}) — those were the harder ones for you, so they are the best ones to review.`
        : averageMissedSeconds < averageCorrectSeconds * 0.75
          ? `You spent less time on the questions you missed (${formatSeconds(averageMissedSeconds)}) than on the ones you got right (${formatSeconds(averageCorrectSeconds)}) — slowing down on questions you're unsure of may help.`
          : `You spent about the same time on questions you missed (${formatSeconds(averageMissedSeconds)}) as on ones you got right (${formatSeconds(averageCorrectSeconds)}), so speed wasn't what separated them.`,
    );
  }
  if (rushedMisses.length > 0 && pace) {
    insights.push(
      `${rushedMisses.length === 1 ? "Question" : "Questions"} ${rushedMisses.map((i) => i + 1).join(", ")} ${rushedMisses.length === 1 ? "was" : "were"} answered incorrectly in under ${formatSeconds(Math.round(pace.limit * RUSH_FRACTION))} — you may have rushed.`,
    );
  }

  return {
    totalSeconds: total,
    timedQuestions: timed.length,
    averageSeconds: average,
    pace,
    withinPace,
    overPace,
    averageCorrectSeconds,
    averageMissedSeconds,
    slowest: { index: slowestRow.index, seconds: slowestRow.seconds },
    rushedMisses,
    rows,
    insights,
  };
}
