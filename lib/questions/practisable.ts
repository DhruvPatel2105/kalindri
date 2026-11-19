import type { QuestionType } from "./types";

/**
 * The question types students can practise today (they have a payload
 * schema, a scorer, an answer UI and question sets). Everything that offers a
 * type for practice — the navigation menu, the home page, the weights table,
 * the set-building script — reads this one list.
 */
export const PRACTISABLE_TYPES = [
  "REORDER_PARAGRAPH",
  "FIB_RW",
  "FIB_READING",
  "MCS_READING",
  "MCM_READING",
] as const satisfies readonly QuestionType[];

export function isPractisable(type: QuestionType): boolean {
  return (PRACTISABLE_TYPES as readonly QuestionType[]).includes(type);
}
