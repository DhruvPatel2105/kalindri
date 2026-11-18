/**
 * Question mastery: of the unique questions a student has answered, how many
 * were answered correctly the LAST time they were answered. Pure; the rows
 * come from lib/practice/listMastery.ts.
 *
 * "Latest completed answer": rows are attempts from COMPLETED practice
 * sessions (full or retry) that were answered and marked. A blank answer is
 * not an answer, so skipping a question later doesn't undo an earlier
 * result; an answer still awaiting its mark isn't counted yet. A question
 * answered wrong in a full test and right in its retry is mastered; the
 * reverse is not.
 *
 * Reported separately from accuracy: accuracy describes sessions, mastery
 * describes questions.
 */

import type { QuestionType } from "@/lib/questions/types";

import { percentOf } from "./testResults";

export interface MasteryAttempt {
  questionId: string;
  type: QuestionType;
  /** Full marks? null = not marked yet. */
  isCorrect: boolean | null;
  submittedAt: Date;
}

export interface Mastery {
  /** Unique questions answered at least once (and marked). */
  unique: number;
  /** Of those, the ones whose latest answer was correct. */
  mastered: number;
  /** mastered ÷ unique × 100; null if none answered. */
  percent: number | null;
}

function toMastery(unique: number, mastered: number): Mastery {
  return { unique, mastered, percent: percentOf(mastered, unique) };
}

export function computeMastery(attempts: readonly MasteryAttempt[]): {
  overall: Mastery;
  byType: Map<QuestionType, Mastery>;
} {
  // Latest marked answer per question; on a tie in time, the later row wins.
  const latest = new Map<string, MasteryAttempt>();
  for (const attempt of attempts) {
    if (attempt.isCorrect === null) continue;
    const current = latest.get(attempt.questionId);
    if (!current || attempt.submittedAt.getTime() >= current.submittedAt.getTime()) {
      latest.set(attempt.questionId, attempt);
    }
  }

  const counts = new Map<QuestionType, { unique: number; mastered: number }>();
  let unique = 0;
  let mastered = 0;
  for (const attempt of latest.values()) {
    const bucket = counts.get(attempt.type) ?? { unique: 0, mastered: 0 };
    bucket.unique += 1;
    unique += 1;
    if (attempt.isCorrect) {
      bucket.mastered += 1;
      mastered += 1;
    }
    counts.set(attempt.type, bucket);
  }

  return {
    overall: toMastery(unique, mastered),
    byType: new Map(
      [...counts].map(([type, c]) => [type, toMastery(c.unique, c.mastered)]),
    ),
  };
}
