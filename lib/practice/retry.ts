/**
 * Pure helpers for "Practise incorrect questions" retries. No DB access.
 *
 * A retry is a new test made of just the questions a finished test didn't get
 * full marks on (incorrect, partly correct and unanswered). Retries chain: the
 * retry of a retry holds only what is still wrong, until a round is all
 * correct.
 */

import type { TestSummary } from "./testResults";

const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
];

/** 0 → "Original test", 1 → "First retry", 2 → "Second retry" … 11 → "Retry 11". */
export function retryLabel(depth: number): string {
  if (!Number.isInteger(depth) || depth <= 0) return "Original test";
  const ordinal = ORDINALS[depth - 1];
  return ordinal ? `${ordinal} retry` : `Retry ${depth}`;
}

/** What's left to practise after a round: everything that wasn't full marks. */
export function retryCount(summary: TestSummary): number {
  return summary.partial + summary.incorrect + summary.unanswered;
}

/** True when a finished round has nothing left to retry (and nothing still awaiting a mark). */
export function allCorrect(summary: TestSummary): boolean {
  return (
    summary.totalQuestions > 0 &&
    summary.correct === summary.totalQuestions &&
    summary.unscored === 0
  );
}

export interface BarSegment {
  kind: "correct" | "partial" | "incorrect" | "unanswered";
  count: number;
  /** Share of the bar, 0–100. The segments of one bar add to 100. */
  percent: number;
}

/**
 * The proportional progress bar for one round: green correct, amber partly
 * correct, red incorrect, grey unanswered. Empty segments are left out, and
 * an empty round has no segments.
 */
export function barSegments(summary: TestSummary): BarSegment[] {
  const total =
    summary.correct + summary.partial + summary.incorrect + summary.unanswered;
  if (total === 0) return [];

  const raw: Omit<BarSegment, "percent">[] = [
    { kind: "correct", count: summary.correct },
    { kind: "partial", count: summary.partial },
    { kind: "incorrect", count: summary.incorrect },
    { kind: "unanswered", count: summary.unanswered },
  ];
  return raw
    .filter((segment) => segment.count > 0)
    .map((segment) => ({ ...segment, percent: (segment.count / total) * 100 }));
}

/**
 * How many retries deep each session is: 0 for an original test, 1 for its
 * first retry, 2 for the retry of that, and so on. `rows` need only the
 * session id and the session it retries. A retry whose parent isn't in `rows`
 * counts from what is there; a cycle (which shouldn't exist) can't loop.
 */
export function retryDepths(
  rows: readonly { id: string; retryOfSessionId: string | null }[],
): Map<string, number> {
  const parentOf = new Map(rows.map((row) => [row.id, row.retryOfSessionId]));
  const depths = new Map<string, number>();

  for (const row of rows) {
    let depth = 0;
    let cursor = parentOf.get(row.id) ?? null;
    const seen = new Set<string>([row.id]);
    while (cursor && parentOf.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      depth += 1;
      cursor = parentOf.get(cursor) ?? null;
    }
    // A parent that isn't in `rows` is still one step up.
    if (cursor && !parentOf.has(cursor)) depth += 1;
    depths.set(row.id, depth);
  }
  return depths;
}
