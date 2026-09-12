/**
 * Exact-match scoring — docs/02-scoring-spec.md §3: "MCQ Single (Reading): 1
 * or 0", "MCQ Single (Listening): 1 or 0", "Select Missing Word: 1 or 0".
 *
 * Used for MCS_READING, MCS_LISTENING and SELECT_MISSING_WORD (see their
 * schemas in lib/questions/schemas/ — all three share a `correct_option_id`
 * field). The comparison runs through the shared `normalise()` first, so a
 * trailing space or case difference in stored data can't silently flip a
 * correct answer to incorrect.
 *
 * Usage: `scoreExactMatch({ correctAnswer: payload.correct_option_id,
 * response: studentSelectedOptionId })`
 */

import { normalise } from "./normalise";

export interface ExactMatchInput {
  /** The answer key — e.g. `correct_option_id` from the question payload. */
  correctAnswer: string;
  /** What the student submitted — e.g. the id of the option they selected. */
  response: string;
}

export interface ExactMatchResult {
  score: 0 | 1;
  maxScore: 1;
  correct: boolean;
}

export function scoreExactMatch(input: ExactMatchInput): ExactMatchResult {
  const correct = normalise(input.correctAnswer) === normalise(input.response);
  return { score: correct ? 1 : 0, maxScore: 1, correct };
}
