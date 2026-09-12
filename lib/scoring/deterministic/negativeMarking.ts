/**
 * Negative-marking scoring — docs/02-scoring-spec.md §3: "+1 correct, -1
 * incorrect, floor 0." Used for MCM_READING, MCM_LISTENING and
 * HIGHLIGHT_INCORRECT_WORDS (see their schemas in lib/questions/schemas/ —
 * `correct_option_ids: string[]` for the two MCM types,
 * `altered_word_indices: number[]` for Highlight Incorrect Words; the
 * generic `T` below is `string` for the former, `number` for the latter).
 *
 * CLAUDE.md "Scoring rules that are easy to get wrong": simple set
 * intersection inflates every score — an incorrect selection must actively
 * subtract, not just fail to add.
 *
 * The floor is structural, not a clamp bolted on afterwards: `score` has
 * exactly one assignment in this file, and it is always the result of
 * `Math.max(0, ...)`. There is no code path that can produce a negative
 * score, however wrong the input — see negativeMarking.test.ts's "all
 * incorrect" and "more incorrect than possible correct" cases.
 *
 * Both `correctSelections` and `studentSelections` are de-duplicated via
 * `Set` before comparison, so a repeated selection can't be counted twice in
 * either direction.
 */

export interface NegativeMarkingInput<T extends string | number = string> {
  /** The full set of correct selections — e.g. `correct_option_ids`. */
  correctSelections: readonly T[];
  /** What the student selected. */
  studentSelections: readonly T[];
}

export interface NegativeMarkingResult {
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
}

export function scoreNegativeMarking<T extends string | number>(
  input: NegativeMarkingInput<T>,
): NegativeMarkingResult {
  const correctSet = new Set(input.correctSelections);
  const studentSet = new Set(input.studentSelections);

  let correctCount = 0;
  let incorrectCount = 0;
  for (const selection of studentSet) {
    if (correctSet.has(selection)) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const rawScore = correctCount - incorrectCount;

  return {
    score: Math.max(0, rawScore),
    maxScore: correctSet.size,
    correctCount,
    incorrectCount,
  };
}
