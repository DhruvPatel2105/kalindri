/**
 * Per-word spelling scoring — docs/02-scoring-spec.md §3: "+1 per correctly
 * SPELLED word" (Write from Dictation, Fill in the Blanks - Listening).
 * CLAUDE.md: "a misspelled word = 0 for that word" — each position is scored
 * independently, so one wrong word never costs credit for any other word.
 *
 * Deliberately lighter-touch than `normalise()`: case and surrounding
 * punctuation are ignored (a student isn't penalised for capitalising the
 * first word of a sentence, or for a trailing period), but nothing internal
 * to the word is touched — spelling is exactly what's being scored, so an
 * apostrophe inside a contraction ("don't" vs "dont") or a mid-word hyphen
 * matters and is preserved.
 *
 * `scoreWriteFromDictation` and `scoreFibListening` are typed convenience
 * wrappers over the shared `scoreWordBySpelling`, matching
 * WRITE_FROM_DICTATION's `sentence_text` and FIB_LISTENING's `transcript` +
 * `blank_word_indices` schema fields directly (lib/questions/schemas/).
 */

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function spellingKey(word: string): string {
  return word.trim().toLowerCase().replace(EDGE_PUNCTUATION, "");
}

export interface WordComparison {
  expected: string;
  submitted: string;
}

export interface WordScore extends WordComparison {
  correct: boolean;
}

export interface WordBySpellingResult {
  score: number;
  maxScore: number;
  words: WordScore[];
}

/** Scores an already-paired list of (expected, submitted) words. */
export function scoreWordBySpelling(
  comparisons: readonly WordComparison[],
): WordBySpellingResult {
  const words = comparisons.map((comparison) => ({
    ...comparison,
    correct: spellingKey(comparison.expected) === spellingKey(comparison.submitted),
  }));

  return {
    score: words.reduce((total, word) => total + (word.correct ? 1 : 0), 0),
    maxScore: words.length,
    words,
  };
}

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter((word) => word.length > 0);
}

export interface WriteFromDictationInput {
  /** The target sentence — `sentence_text` from the WRITE_FROM_DICTATION payload. */
  targetSentence: string;
  /** What the student typed. */
  studentResponse: string;
}

/**
 * Compares word-for-word by position (dictation requires reproducing the
 * sentence in order). Missing trailing words score 0 for their position;
 * extra trailing words beyond the target length are ignored rather than
 * penalised or double-counted.
 */
export function scoreWriteFromDictation(
  input: WriteFromDictationInput,
): WordBySpellingResult {
  const targetWords = splitWords(input.targetSentence);
  const studentWords = splitWords(input.studentResponse);

  const comparisons: WordComparison[] = targetWords.map((expected, index) => ({
    expected,
    submitted: studentWords[index] ?? "",
  }));

  return scoreWordBySpelling(comparisons);
}

export interface FibListeningInput {
  /** The full transcript — `transcript` from the FIB_LISTENING payload. */
  transcript: string;
  /** Word indices that were blanked out — `blank_word_indices` from the payload. */
  blankWordIndices: readonly number[];
  /** The student's typed word for each blank, in the same order as `blankWordIndices`. */
  submittedWords: readonly string[];
}

/** Scores only the blanked-out positions; the rest of the transcript is given. */
export function scoreFibListening(input: FibListeningInput): WordBySpellingResult {
  const transcriptWords = splitWords(input.transcript);

  const comparisons: WordComparison[] = input.blankWordIndices.map(
    (wordIndex, i) => ({
      expected: transcriptWords[wordIndex] ?? "",
      submitted: input.submittedWords[i] ?? "",
    }),
  );

  return scoreWordBySpelling(comparisons);
}
