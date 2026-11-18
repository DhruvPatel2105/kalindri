/**
 * The scoring rules an attempt was marked under, saved with the attempt
 * (`attempts.scoring_rules`) so a historical report can say how it was marked
 * even if the rules change later. The scorers themselves live in
 * lib/scoring/registry.ts; this only DESCRIBES the deterministic ones, in
 * words matching docs/02-scoring-spec.md, and is the single place those
 * descriptions are kept. Bump SCORER_VERSION when a scorer's behaviour
 * changes (scores rows carry the same string in `scorer_version`).
 */

import { isDeterministicType } from "@/lib/scoring/registry";
import type { QuestionType } from "@/lib/questions/types";

export const SCORER_VERSION = "deterministic-v1";

export interface ScoringRulesSnapshot {
  /** The scorer family in lib/scoring/deterministic/. */
  scorer: "exactMatch" | "negativeMarking" | "adjacentPairs" | "wordBySpelling";
  scorerVersion: string;
  /** The rule in plain words, as a student or admin would read it. */
  rule: string;
}

const RULES: Record<string, Omit<ScoringRulesSnapshot, "scorerVersion">> = {
  MCS_READING: { scorer: "exactMatch", rule: "1 mark for the correct option, 0 otherwise." },
  MCS_LISTENING: { scorer: "exactMatch", rule: "1 mark for the correct option, 0 otherwise." },
  SELECT_MISSING_WORD: { scorer: "exactMatch", rule: "1 mark for the correct option, 0 otherwise." },
  MCM_READING: {
    scorer: "negativeMarking",
    rule: "+1 for each correct selection, −1 for each incorrect selection, never below 0.",
  },
  MCM_LISTENING: {
    scorer: "negativeMarking",
    rule: "+1 for each correct selection, −1 for each incorrect selection, never below 0.",
  },
  HIGHLIGHT_INCORRECT_WORDS: {
    scorer: "negativeMarking",
    rule: "+1 for each correctly highlighted word, −1 for each incorrectly highlighted word, never below 0.",
  },
  REORDER_PARAGRAPH: {
    scorer: "adjacentPairs",
    rule: "1 mark for each adjacent pair of boxes in the correct order and direction; N boxes give a maximum of N−1.",
  },
  FIB_RW: {
    scorer: "wordBySpelling",
    rule: "1 mark for each blank answered correctly; no penalty for a wrong or empty blank.",
  },
  FIB_READING: {
    scorer: "wordBySpelling",
    rule: "1 mark for each blank answered correctly; no penalty for a wrong or empty blank.",
  },
  FIB_LISTENING: {
    scorer: "wordBySpelling",
    rule: "1 mark for each blank spelled correctly; a misspelled word scores 0.",
  },
  WRITE_FROM_DICTATION: {
    scorer: "wordBySpelling",
    rule: "1 mark for each correctly spelled word of the sentence; a misspelled word scores 0.",
  },
};

/** The rules a deterministic type is marked under, or null for types scored another way (AI or speech). */
export function scoringRulesFor(type: QuestionType): ScoringRulesSnapshot | null {
  if (!isDeterministicType(type)) return null;
  const rules = RULES[type];
  return rules ? { ...rules, scorerVersion: SCORER_VERSION } : null;
}
