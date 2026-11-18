/**
 * Pure roll-ups of a student's finished practice sessions: for one question
 * type, or across all of them. No DB access.
 *
 * Two kinds of session are kept apart:
 *   - FULL practice (an original test) — "full-test" figures.
 *   - INCORRECT practice (a retry) — "retry" figures.
 * They never mix: retry sessions are not in the full-test accuracy, trend or
 * improvement (they repeat questions whose answers the student has just been
 * shown), and have their own accuracy. Only COMPLETED sessions are passed in.
 *
 * Every percentage is WEIGHTED: it is calculated from summed counts (total
 * correct ÷ total questions), never by averaging per-session percentages, so
 * a 5-question session counts for less than a 15-question one — and all of it
 * goes through percentOf (testResults.ts) so rounding and the empty case are
 * the same everywhere.
 *
 * All scores are RAW MARKS, never a PTE 10–90 score or a CLB estimate
 * (CLAUDE.md scoring honesty rules).
 */

import type { QuestionType } from "@/lib/questions/types";

import { percentOf, type TestSummary } from "./testResults";

/**
 * Time between start and submit includes any time the student was away from
 * the test (we don't track active time yet), so one session counts for at
 * most this long toward practice time.
 */
export const MAX_SESSION_MS = 2 * 60 * 60 * 1000;

export interface FinishedSession {
  sessionId: string;
  startedAt: Date;
  completedAt: Date;
  /** True for an INCORRECT_PRACTICE session, false for FULL_PRACTICE. */
  isRetry: boolean;
  summary: TestSummary;
}

export interface TrendPoint {
  sessionId: string;
  startedAt: Date;
  /** The full test's accuracy; null while it still has answers awaiting a mark. */
  percent: number | null;
}

export interface Improvement {
  /** Accuracy of the most recent completed full test. */
  latestPercent: number;
  /** Accuracy of the completed full test before it. */
  previousPercent: number;
  /** latest − previous, in percentage points (may be negative). */
  points: number;
}

/** Everything about one kind of session (all the full tests, or all the retries). */
export interface GroupStats {
  /** Completed sessions of this kind. */
  sessions: number;
  questions: {
    /** Every question asked across the sessions. */
    total: number;
    /** Questions with an answer, right or wrong. */
    attempted: number;
    /** Full marks. */
    correct: number;
    /** Some marks, not all. */
    partial: number;
    /** Answered, no marks. */
    incorrect: number;
    /** Left blank (counted as not correct). */
    unanswered: number;
  };
  /** Σ correct ÷ Σ total questions × 100. Sessions still awaiting a mark are left out. Null if nothing to measure. */
  accuracyPercent: number | null;
  /** Σ attempted ÷ Σ total questions × 100. */
  completionPercent: number | null;
  /** Σ marks earned ÷ Σ marks available × 100 (partial credit counts). */
  marksPercent: number | null;
  marks: { score: number; maxScore: number };
}

export interface TypeStats {
  /** Completed FULL_PRACTICE sessions. */
  full: GroupStats;
  /** Completed INCORRECT_PRACTICE sessions. */
  retry: GroupStats;
  /** Practice time over full AND retry sessions, each capped (see MAX_SESSION_MS). */
  practiceSeconds: number;
  /** practiceSeconds ÷ completed sessions (full + retry); null if there are none. */
  averageSessionSeconds: number | null;
  /** Questions attempted across full and retry sessions. */
  questionsPractised: number;
  /** Full tests oldest → newest, for the trend chart (accuracy each). */
  trend: TrendPoint[];
  /** Latest full test vs the one before it; null with fewer than two measurable full tests. */
  improvement: Improvement | null;
}

/** Time a session counts toward practice time, in ms: start → submit, clamped to [0, MAX_SESSION_MS]. */
export function cappedDurationMs(startedAt: Date, completedAt: Date): number {
  const ms = completedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, MAX_SESSION_MS);
}

/** Latest completed full test's accuracy minus the previous one's. `accuracies` are oldest first; null entries (unmarked) are skipped. */
export function computeImprovement(
  accuracies: readonly (number | null)[],
): Improvement | null {
  const measurable = accuracies.flatMap((a) => (a === null ? [] : [a]));
  if (measurable.length < 2) return null;
  const latest = measurable[measurable.length - 1];
  const previous = measurable[measurable.length - 2];
  if (latest === undefined || previous === undefined) return null;
  return { latestPercent: latest, previousPercent: previous, points: latest - previous };
}

function groupStats(sessions: readonly FinishedSession[]): GroupStats {
  const questions = { total: 0, attempted: 0, correct: 0, partial: 0, incorrect: 0, unanswered: 0 };
  const marks = { score: 0, maxScore: 0 };
  // Accuracy only counts sessions whose every answer has been marked, so a
  // pending mark never understates it.
  let markedCorrect = 0;
  let markedTotal = 0;

  for (const { summary } of sessions) {
    questions.total += summary.totalQuestions;
    questions.attempted += summary.answered;
    questions.correct += summary.correct;
    questions.partial += summary.partial;
    questions.incorrect += summary.incorrect;
    questions.unanswered += summary.unanswered;
    marks.score += summary.score;
    marks.maxScore += summary.maxScore;
    if (summary.unscored === 0) {
      markedCorrect += summary.correct;
      markedTotal += summary.totalQuestions;
    }
  }

  return {
    sessions: sessions.length,
    questions,
    accuracyPercent: percentOf(markedCorrect, markedTotal),
    completionPercent: percentOf(questions.attempted, questions.total),
    marksPercent: percentOf(marks.score, marks.maxScore),
    marks,
  };
}

export function computeTypeStats(finished: readonly FinishedSession[]): TypeStats {
  const ordered = [...finished].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const fullSessions = ordered.filter((s) => !s.isRetry);
  const retrySessions = ordered.filter((s) => s.isRetry);
  const full = groupStats(fullSessions);
  const retry = groupStats(retrySessions);

  const trend: TrendPoint[] = fullSessions.map((s) => ({
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    percent: s.summary.accuracyPercent,
  }));

  const practiceMs = ordered.reduce(
    (sum, s) => sum + cappedDurationMs(s.startedAt, s.completedAt),
    0,
  );

  return {
    full,
    retry,
    practiceSeconds: Math.round(practiceMs / 1000),
    averageSessionSeconds:
      ordered.length > 0 ? Math.round(practiceMs / 1000 / ordered.length) : null,
    questionsPractised: full.questions.attempted + retry.questions.attempted,
    trend,
    improvement: computeImprovement(trend.map((t) => t.percent)),
  };
}

/**
 * Stats for everything a student has finished — `overall` across all types
 * (computeTypeStats works on any set of sessions), and `byType` for each type
 * they have at least one finished session of. Overall figures are weighted
 * over the underlying sessions, so they always agree with the per-type ones.
 */
export function computeAllStats(
  finished: readonly (FinishedSession & { type: QuestionType })[],
): { overall: TypeStats; byType: Map<QuestionType, TypeStats> } {
  const grouped = new Map<QuestionType, FinishedSession[]>();
  for (const session of finished) {
    const list = grouped.get(session.type) ?? [];
    list.push(session);
    grouped.set(session.type, list);
  }
  return {
    overall: computeTypeStats(finished),
    byType: new Map([...grouped].map(([type, list]) => [type, computeTypeStats(list)])),
  };
}
