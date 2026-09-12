/**
 * Shared text normalisation — docs/02-scoring-spec.md §2.
 *
 * Used directly by `exactMatch.ts`, and exported standalone because
 * ANSWER_SHORT_QUESTION (scored from a speech transcript) needs exactly this
 * normalisation without exactMatch's equality-check wrapper (CLAUDE.md
 * "Scoring rules that are easy to get wrong": normalisation is mandatory
 * there, or "a doctor" is marked wrong against a key of "doctor").
 *
 * Steps, in order (order matters — see inline notes):
 *   1. lowercase
 *   2. expand common contractions (must run before punctuation is stripped,
 *      since contractions are identified by their apostrophe)
 *   3. strip punctuation (replaced with a space, not deleted, so adjoining
 *      words never get glued together — "well-known" -> "well known", not
 *      "wellknown")
 *   4. collapse whitespace and trim
 *   5. strip a single leading article (a / an / the)
 *
 * NOT synonym matching — deferred to V2 per the spec. Only
 * ANSWER_SHORT_QUESTION carries `accepted_variants`, handled by its own
 * scorer (a later session), not by this function.
 */

const CONTRACTIONS: Readonly<Record<string, string>> = {
  "aren't": "are not",
  "can't": "cannot",
  "could've": "could have",
  "couldn't": "could not",
  "didn't": "did not",
  "doesn't": "does not",
  "don't": "do not",
  "hadn't": "had not",
  "hasn't": "has not",
  "haven't": "have not",
  "he'd": "he would",
  "he'll": "he will",
  "he's": "he is",
  "here's": "here is",
  "i'd": "i would",
  "i'll": "i will",
  "i'm": "i am",
  "i've": "i have",
  "isn't": "is not",
  "it'd": "it would",
  "it'll": "it will",
  "it's": "it is",
  "let's": "let us",
  "might've": "might have",
  "mustn't": "must not",
  "shan't": "shall not",
  "she'd": "she would",
  "she'll": "she will",
  "she's": "she is",
  "should've": "should have",
  "shouldn't": "should not",
  "that's": "that is",
  "there's": "there is",
  "they'd": "they would",
  "they'll": "they will",
  "they're": "they are",
  "they've": "they have",
  "wasn't": "was not",
  "we'd": "we would",
  "we'll": "we will",
  "we're": "we are",
  "we've": "we have",
  "weren't": "were not",
  "what's": "what is",
  "who's": "who is",
  "won't": "will not",
  "would've": "would have",
  "wouldn't": "would not",
  "you'd": "you would",
  "you'll": "you will",
  "you're": "you are",
  "you've": "you have",
};

const CONTRACTION_PATTERN = /\b[a-z]+'[a-z]+\b/g;
const CURLY_APOSTROPHES = /[‘’]/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;
const LEADING_ARTICLE = /^(a|an|the)\s+/;

export function normalise(input: string): string {
  let text = input.toLowerCase();
  text = text.replace(CURLY_APOSTROPHES, "'");
  text = text.replace(
    CONTRACTION_PATTERN,
    (match) => CONTRACTIONS[match] ?? match,
  );
  text = text.replace(NON_ALPHANUMERIC, " ");
  text = text.replace(WHITESPACE, " ").trim();
  text = text.replace(LEADING_ARTICLE, "");
  return text;
}
