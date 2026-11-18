/**
 * Pure roll-up of a finished practice test. No DB access.
 *
 * These are RAW MARKS (e.g. 31/45), not a PTE 10–90 score, CLB band or any
 * estimate of one — a single question set is far too small a sample to say
 * anything about a scaled score (CLAUDE.md scoring honesty rules).
 */

import { z } from "zod";

export interface QuestionOutcome {
  /** Whether the student gave an answer (see testState.isAnswered). */
  answered: boolean;
  /** Marks earned; null when the answer has no score yet (scoring failed or pending). */
  score: number | null;
  /** Marks available; null if it can't be determined. */
  maxScore: number | null;
}

export interface TestSummary {
  totalQuestions: number;
  answered: number;
  unanswered: number;
  /** Answered questions whose score is missing — the results page retries these. */
  unscored: number;
  /** Full marks. */
  correct: number;
  /** Some marks but not all (a multi-blank or multi-pair question). */
  partial: number;
  /** Answered, no marks. */
  incorrect: number;
  score: number;
  maxScore: number;
  /** Whole-number percentage of available marks, or null when no marks are available. */
  percent: number | null;
  /**
   * Of the answered questions that have been marked, the percentage that got
   * FULL marks — "how often I was right when I answered". Differs from
   * `percent`, which counts partial marks and unanswered questions. Null if
   * nothing marked was answered.
   */
  accuracyPercent: number | null;
}

export function summarizeTest(outcomes: readonly QuestionOutcome[]): TestSummary {
  let answered = 0;
  let unscored = 0;
  let score = 0;
  let maxScore = 0;
  const kinds = { correct: 0, partial: 0, incorrect: 0 };

  for (const outcome of outcomes) {
    const kind = resultKind(outcome);
    if (kind === "correct" || kind === "partial" || kind === "incorrect") {
      kinds[kind] += 1;
    }
    if (outcome.answered) {
      answered += 1;
      if (outcome.score === null) unscored += 1;
    }
    // An unscored answer contributes no marks yet, but its maximum still counts.
    score += outcome.answered ? (outcome.score ?? 0) : 0;
    maxScore += outcome.maxScore ?? 0;
  }

  const markedAnswered = kinds.correct + kinds.partial + kinds.incorrect;

  return {
    totalQuestions: outcomes.length,
    answered,
    unanswered: outcomes.length - answered,
    unscored,
    ...kinds,
    score,
    maxScore,
    percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : null,
    accuracyPercent: markedAnswered > 0 ? Math.round((kinds.correct / markedAnswered) * 100) : null,
  };
}

export type QuestionResultKind = "correct" | "partial" | "incorrect" | "unanswered";

/**
 * How a question went, for colouring and labels. Full marks is "correct",
 * some marks "partial", none "incorrect"; a question with no answer is
 * "unanswered" whatever its marks. Returns null for an answered question
 * whose marks aren't known yet (scoring pending or failed) — show "not
 * marked yet" for that, never guess.
 */
export function resultKind(outcome: QuestionOutcome): QuestionResultKind | null {
  if (!outcome.answered) return "unanswered";
  if (outcome.score === null || outcome.maxScore === null) return null;
  if (outcome.score >= outcome.maxScore && outcome.maxScore > 0) return "correct";
  if (outcome.score > 0) return "partial";
  return "incorrect";
}

export interface ReviewItem {
  /** 0-based question index. */
  index: number;
  kind: Exclude<QuestionResultKind, "correct">;
}

/**
 * The questions worth going back to: everything that wasn't full marks —
 * incorrect, partly correct and unanswered — in test order. Answered
 * questions that haven't been marked yet are left out (nothing to review
 * until they are).
 */
export function questionsToReview(outcomes: readonly QuestionOutcome[]): ReviewItem[] {
  const items: ReviewItem[] = [];
  outcomes.forEach((outcome, index) => {
    const kind = resultKind(outcome);
    if (kind && kind !== "correct") items.push({ index, kind });
  });
  return items;
}

const countSchema = z.number().int().nonnegative();
const storedSummarySchema = z.object({
  totalQuestions: countSchema,
  answered: countSchema,
  unanswered: countSchema,
  unscored: countSchema,
  correct: countSchema,
  partial: countSchema,
  incorrect: countSchema,
  score: z.number().nonnegative(),
  maxScore: z.number().nonnegative(),
  percent: z.number().nullable(),
  accuracyPercent: z.number().nullable(),
});

/**
 * Reads a TestSummary back from `sessions.result_summary`. Never throws: a
 * missing or malformed value is null, and the caller recomputes from the
 * attempts and scores (which stay the source of truth).
 */
export function parseStoredSummary(value: unknown): TestSummary | null {
  const parsed = storedSummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
