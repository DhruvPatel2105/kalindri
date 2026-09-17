/**
 * The scorer registry — docs/02-scoring-spec.md §1: "Every question type
 * resolves through a scorer registry ... Adding a type means one Zod schema,
 * one React component, one scorer. Nothing else changes."
 *
 * Two things live here:
 *
 *   1. `SCORING_CATEGORY_BY_TYPE` — every QuestionType's scoring family/ies:
 *      'deterministic' | 'llm' | 'speech'. DESCRIBE_IMAGE and
 *      RESPOND_TO_SITUATION carry BOTH 'llm' (content, against `key_points`)
 *      and 'speech' (Azure pronunciation/fluency) — spec §8's "Per-type
 *      approach" table scores their content and delivery independently — so
 *      this is `readonly ScoringCategory[]`, not a single value.
 *
 *   2. `scoreDeterministic` — the entry point for the 'deterministic' family
 *      only. llm and speech scorers don't exist yet (later sessions); calling
 *      this for one of those types throws `NotDeterministicScorerError`
 *      rather than silently returning a result.
 *
 * NOTE on the "10 deterministic types" figure: docs/02-scoring-spec.md §1's
 * prose says "10 types", but its own §3 rules table lists 11 rows (it
 * includes both R&W Fill in the Blanks and Reading Fill in the Blanks). 11 is
 * also the number required for every QuestionType to land in at least one
 * category with no gaps: 11 deterministic + 3 llm-only (WRITE_EMAIL,
 * SUMMARIZE_WRITTEN_TEXT, SUMMARIZE_SPOKEN_TEXT) + 3 speech-only (READ_ALOUD,
 * REPEAT_SENTENCE, ANSWER_SHORT_QUESTION) + 2 hybrid (DESCRIBE_IMAGE,
 * RESPOND_TO_SITUATION, counted once) = 19. This registry uses 11 and flags
 * the doc's "10" as a stale count worth fixing at the source.
 *
 * FIB_RW and FIB_READING: session 4 didn't ship a dedicated scorer file for
 * either. Both are, per §3, "+1 per correct blank, no negative marking" over
 * a fixed set of pre-supplied strings (multiple-choice options / a word
 * bank) — structurally identical to `scoreWordBySpelling`'s "compare each
 * expected/submitted pair independently, no penalty for a miss" behaviour.
 * Rather than add a new scorer file in a session scoped to the registry, both
 * are wired to the existing `scoreWordBySpelling` primitive.
 */

import type { z } from "zod";

import { questionSchemas } from "@/lib/questions/schemas";
import type { QuestionType } from "@/lib/questions/types";

import {
  scoreAdjacentPairs,
  type AdjacentPairsResult,
} from "./deterministic/adjacentPairs";
import { scoreExactMatch, type ExactMatchResult } from "./deterministic/exactMatch";
import {
  scoreNegativeMarking,
  type NegativeMarkingResult,
} from "./deterministic/negativeMarking";
import {
  scoreFibListening,
  scoreWordBySpelling,
  scoreWriteFromDictation,
  type WordBySpellingResult,
} from "./deterministic/wordBySpelling";

type Payload<T extends QuestionType> = z.infer<(typeof questionSchemas)[T]>;

// ---------------------------------------------------------------------------
// 1. Scoring category assignment — every QuestionType, no gaps.
// ---------------------------------------------------------------------------

export const SCORING_CATEGORIES = ["deterministic", "llm", "speech"] as const;
export type ScoringCategory = (typeof SCORING_CATEGORIES)[number];

/**
 * docs/02-scoring-spec.md §1 (families) and §8 (per-type speaking approach).
 * A type may carry more than one category — see the DESCRIBE_IMAGE /
 * RESPOND_TO_SITUATION note above.
 */
export const SCORING_CATEGORY_BY_TYPE = {
  READ_ALOUD: ["speech"],
  REPEAT_SENTENCE: ["speech"],
  DESCRIBE_IMAGE: ["llm", "speech"],
  RESPOND_TO_SITUATION: ["llm", "speech"],
  ANSWER_SHORT_QUESTION: ["speech"],
  SUMMARIZE_WRITTEN_TEXT: ["llm"],
  WRITE_EMAIL: ["llm"],

  FIB_RW: ["deterministic"],
  MCM_READING: ["deterministic"],
  REORDER_PARAGRAPH: ["deterministic"],
  FIB_READING: ["deterministic"],
  MCS_READING: ["deterministic"],

  SUMMARIZE_SPOKEN_TEXT: ["llm"],
  MCM_LISTENING: ["deterministic"],
  FIB_LISTENING: ["deterministic"],
  MCS_LISTENING: ["deterministic"],
  SELECT_MISSING_WORD: ["deterministic"],
  HIGHLIGHT_INCORRECT_WORDS: ["deterministic"],
  WRITE_FROM_DICTATION: ["deterministic"],
} satisfies Record<QuestionType, readonly ScoringCategory[]>;

// ---------------------------------------------------------------------------
// 2. Deterministic scorers — the 11 types whose category includes
//    'deterministic'.
// ---------------------------------------------------------------------------

export const DETERMINISTIC_QUESTION_TYPES = [
  "FIB_RW",
  "MCM_READING",
  "REORDER_PARAGRAPH",
  "FIB_READING",
  "MCS_READING",
  "MCM_LISTENING",
  "FIB_LISTENING",
  "MCS_LISTENING",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "WRITE_FROM_DICTATION",
] as const;

export type DeterministicQuestionType =
  (typeof DETERMINISTIC_QUESTION_TYPES)[number];

export function isDeterministicType(
  type: QuestionType,
): type is DeterministicQuestionType {
  return (DETERMINISTIC_QUESTION_TYPES as readonly QuestionType[]).includes(
    type,
  );
}

export type DeterministicScoreResult =
  | ExactMatchResult
  | NegativeMarkingResult
  | AdjacentPairsResult
  | WordBySpellingResult;

/**
 * What the student submitted, per deterministic type. Payload shapes come
 * straight from `questionSchemas`; these are the response shapes each
 * scorer needs on top of that payload.
 */
export interface DeterministicResponseByType {
  /** Selected option per blank, in the same order as `payload.blanks`. */
  FIB_RW: readonly string[];
  /** Selected `options[].id` values. */
  MCM_READING: readonly string[];
  /** The student's box order (same items as `payload.boxes`, reordered). */
  REORDER_PARAGRAPH: readonly string[];
  /** Chosen word per blank, in the same order as `payload.correct_answers`. */
  FIB_READING: readonly string[];
  /** Selected `options[].id`. */
  MCS_READING: string;
  /** Selected `options[].id` values. */
  MCM_LISTENING: readonly string[];
  /** Typed word per blank, in the same order as `payload.blank_word_indices`. */
  FIB_LISTENING: readonly string[];
  /** Selected `options[].id`. */
  MCS_LISTENING: string;
  /** Selected `options[].id`. */
  SELECT_MISSING_WORD: string;
  /** Word indices the student flagged as altered. */
  HIGHLIGHT_INCORRECT_WORDS: readonly number[];
  /** The sentence the student typed. */
  WRITE_FROM_DICTATION: string;
}

type DeterministicScorer<T extends DeterministicQuestionType> = (
  payload: Payload<T>,
  response: DeterministicResponseByType[T],
) => DeterministicScoreResult;

/**
 * Every deterministic scorer FILE actually referenced below, excluding
 * `normalise.ts` (a shared helper `exactMatch.ts` uses internally, not a
 * directly-wired per-type scorer). registry.test.ts cross-checks this count
 * against the scorer test files on disk so a scorer file added or removed
 * without updating this registry — or vice versa — fails a test instead of
 * drifting silently.
 */
export const DETERMINISTIC_SCORER_FILES = [
  "adjacentPairs",
  "exactMatch",
  "negativeMarking",
  "wordBySpelling",
] as const;

export const deterministicScorers: {
  [T in DeterministicQuestionType]: DeterministicScorer<T>;
} = {
  FIB_RW: (payload, response) =>
    scoreWordBySpelling(
      payload.blanks.map((blank, i) => ({
        expected: blank.correct_option,
        submitted: response[i] ?? "",
      })),
    ),
  MCM_READING: (payload, response) =>
    scoreNegativeMarking({
      correctSelections: payload.correct_option_ids,
      studentSelections: response,
    }),
  REORDER_PARAGRAPH: (payload, response) =>
    scoreAdjacentPairs({
      correctOrder: payload.boxes,
      studentOrder: response,
    }),
  FIB_READING: (payload, response) =>
    scoreWordBySpelling(
      payload.correct_answers.map((answer, i) => ({
        expected: answer,
        submitted: response[i] ?? "",
      })),
    ),
  MCS_READING: (payload, response) =>
    scoreExactMatch({
      correctAnswer: payload.correct_option_id,
      response,
    }),
  MCM_LISTENING: (payload, response) =>
    scoreNegativeMarking({
      correctSelections: payload.correct_option_ids,
      studentSelections: response,
    }),
  FIB_LISTENING: (payload, response) =>
    scoreFibListening({
      transcript: payload.transcript,
      blankWordIndices: payload.blank_word_indices,
      submittedWords: response,
    }),
  MCS_LISTENING: (payload, response) =>
    scoreExactMatch({
      correctAnswer: payload.correct_option_id,
      response,
    }),
  SELECT_MISSING_WORD: (payload, response) =>
    scoreExactMatch({
      correctAnswer: payload.correct_option_id,
      response,
    }),
  HIGHLIGHT_INCORRECT_WORDS: (payload, response) =>
    scoreNegativeMarking({
      correctSelections: payload.altered_word_indices,
      studentSelections: response,
    }),
  WRITE_FROM_DICTATION: (payload, response) =>
    scoreWriteFromDictation({
      targetSentence: payload.sentence_text,
      studentResponse: response,
    }),
};

/** Thrown by `scoreDeterministic` for any type whose category isn't 'deterministic'. */
export class NotDeterministicScorerError extends Error {
  constructor(
    public readonly type: QuestionType,
    public readonly categories: readonly ScoringCategory[],
  ) {
    super(
      `scoreDeterministic: '${type}' has no deterministic scorer — its ` +
        `categor${categories.length === 1 ? "y is" : "ies are"} ` +
        `[${categories.join(", ")}]. llm and speech scorers aren't built yet.`,
    );
    this.name = "NotDeterministicScorerError";
  }
}

/**
 * The single entry point for deterministic scoring — docs/02-scoring-spec.md
 * §1's "Deterministic pre-scoring" step, run before any LLM/speech call.
 *
 * Typed via overloads so a `DeterministicQuestionType` literal gets a fully
 * typed payload/response/result, while any other `QuestionType` still
 * type-checks (its return type is `never`, matching the fact that it always
 * throws). The cast inside the implementation is safe because
 * `isDeterministicType` has already confirmed `type` is a key of
 * `deterministicScorers`; matching `payload`/`response` to that `type` is the
 * caller's responsibility, same as with `questionSchemas`.
 */
export function scoreDeterministic<T extends DeterministicQuestionType>(
  type: T,
  payload: Payload<T>,
  response: DeterministicResponseByType[T],
): DeterministicScoreResult;
export function scoreDeterministic(
  type: Exclude<QuestionType, DeterministicQuestionType>,
  payload: unknown,
  response: unknown,
): never;
export function scoreDeterministic(
  type: QuestionType,
  payload: unknown,
  response: unknown,
): DeterministicScoreResult {
  if (!isDeterministicType(type)) {
    throw new NotDeterministicScorerError(type, SCORING_CATEGORY_BY_TYPE[type]);
  }
  const scorer = deterministicScorers[type] as DeterministicScorer<
    typeof type
  >;
  return scorer(payload as never, response as never);
}
