/**
 * Pure rules for the Reading Mock Test: which question types it contains, in
 * what order, how many of each, the clock, and how a finished mock is broken
 * down by type. No database or browser access, so all of it is unit-tested.
 *
 * Per-type counts follow the official test blueprint
 * (docs/01-question-types.md "Mock test blueprint"): a count is drawn from
 * each type's min–max range, then capped by how many questions exist.
 *
 * The time limit is a product setting (MOCK_TIME_LIMIT_S): one countdown for
 * the whole Reading section. Change it in one place.
 */

import type { QuestionType } from "@/lib/questions/types";

/** The sequence the real Reading section follows. */
export const MOCK_SEQUENCE = [
  { type: "FIB_RW", min: 5, max: 6 },
  { type: "MCM_READING", min: 1, max: 2 },
  { type: "REORDER_PARAGRAPH", min: 2, max: 3 },
  { type: "FIB_READING", min: 4, max: 5 },
  { type: "MCS_READING", min: 1, max: 2 },
] as const satisfies readonly { type: QuestionType; min: number; max: number }[];

export type MockType = (typeof MOCK_SEQUENCE)[number]["type"];

/** One countdown for the whole Reading section (30 minutes). */
export const MOCK_TIME_LIMIT_S = 30 * 60;

/**
 * How many questions of each type this mock has: a whole number in the type's
 * official range, never more than `available`. Types with no questions get 0.
 * `random` is injectable for tests.
 */
export function planMockCounts(
  available: Readonly<Record<MockType, number>>,
  random: () => number = Math.random,
): Record<MockType, number> {
  const counts = {} as Record<MockType, number>;
  for (const { type, min, max } of MOCK_SEQUENCE) {
    const wanted = min + Math.floor(random() * (max - min + 1));
    counts[type] = Math.max(0, Math.min(wanted, available[type] ?? 0));
  }
  return counts;
}

/** The mock can only be sat if every one of the five types has at least one question. */
export function missingMockTypes(available: Readonly<Record<MockType, number>>): MockType[] {
  return MOCK_SEQUENCE.filter(({ type }) => (available[type] ?? 0) < 1).map(({ type }) => type);
}

/** When the clock runs out: the start time plus the time limit. */
export function mockDeadline(startedAt: Date, limitSeconds: number = MOCK_TIME_LIMIT_S): Date {
  return new Date(startedAt.getTime() + limitSeconds * 1000);
}

/** Whole seconds left (never negative). */
export function secondsRemaining(deadline: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

/** "29:05" / "0:07" — minutes and seconds for the countdown. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** One marked question of a finished mock. */
export interface MockQuestionResult {
  type: QuestionType;
  /** Left blank. */
  answered: boolean;
  /** Marks earned; null when the answer has no mark yet. */
  score: number | null;
  maxScore: number | null;
}

export interface MockTypeResult {
  type: MockType;
  questions: number;
  /** Full marks. */
  correct: number;
  /** Some marks but not full. */
  partial: number;
  /** Answered with no marks, or left blank. */
  incorrect: number;
  score: number;
  maxScore: number;
  /** Marks ÷ maximum marks, whole percent; null if the type has no marks available. */
  percent: number | null;
  /** Questions whose marking is still pending. */
  unmarked: number;
}

export interface MockResults {
  perType: MockTypeResult[];
  totalQuestions: number;
  correct: number;
  partial: number;
  incorrect: number;
  score: number;
  maxScore: number;
  percent: number | null;
  unmarked: number;
}

const percentOf = (score: number, max: number): number | null =>
  max > 0 ? Math.round((score / max) * 100) : null;

/**
 * Overall and per-type results, in the exam's sequence. Raw marks only — the
 * marks each question's own scorer gave; no scaled score is computed here.
 * Types with no questions in the mock are left out.
 */
export function summarizeMock(rows: readonly MockQuestionResult[]): MockResults {
  const perType: MockTypeResult[] = [];
  for (const { type } of MOCK_SEQUENCE) {
    const mine = rows.filter((row) => row.type === type);
    if (mine.length === 0) continue;
    let correct = 0;
    let partial = 0;
    let incorrect = 0;
    let unmarked = 0;
    let score = 0;
    let maxScore = 0;
    for (const row of mine) {
      if (row.maxScore !== null) maxScore += row.maxScore;
      if (row.score === null) {
        if (row.answered) {
          unmarked += 1;
        } else {
          incorrect += 1; // left blank
        }
        continue;
      }
      score += row.score;
      if (row.maxScore !== null && row.maxScore > 0 && row.score >= row.maxScore) correct += 1;
      else if (row.score > 0) partial += 1;
      else incorrect += 1;
    }
    perType.push({
      type,
      questions: mine.length,
      correct,
      partial,
      incorrect,
      score,
      maxScore,
      percent: percentOf(score, maxScore),
      unmarked,
    });
  }
  const sum = (pick: (t: MockTypeResult) => number) => perType.reduce((total, t) => total + pick(t), 0);
  const score = sum((t) => t.score);
  const maxScore = sum((t) => t.maxScore);
  return {
    perType,
    totalQuestions: sum((t) => t.questions),
    correct: sum((t) => t.correct),
    partial: sum((t) => t.partial),
    incorrect: sum((t) => t.incorrect),
    score,
    maxScore,
    percent: percentOf(score, maxScore),
    unmarked: sum((t) => t.unmarked),
  };
}
