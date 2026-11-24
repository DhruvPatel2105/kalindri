/**
 * The browser-safe view of a question: what the test runner is allowed to
 * receive BEFORE the student submits. Pure; no DB access.
 *
 * The Server Component payload is visible to the browser, so omitting answer
 * keys here — not just hiding them in the UI — is what actually protects
 * them. This is the one place that decides what leaves the server:
 *
 *   MCS_READING        no `correct_option_id`
 *   MCM_READING        no `correct_option_ids`
 *   FIB_RW             options per blank only, no `correct_option`
 *   FIB_READING        the passage split at the gaps + a SHUFFLED word bank,
 *                      no `correct_answers` (a bank in blank order would give
 *                      the answers away)
 *   REORDER_PARAGRAPH  the boxes SHUFFLED, with positional keys — never the
 *                      true order
 *
 * (Deterrent only for content protection in general — CLAUDE.md — but the
 * answer key itself must never be sent.)
 */

import { questionSchemas } from "@/lib/questions/schemas";
import type { QuestionType } from "@/lib/questions/types";

import type { ReorderBox } from "./reorderBoxes";
import type { QuestionSnapshot } from "./testState";

interface Option {
  id: string;
  text: string;
}

export type ClientQuestion =
  | {
      kind: "MCS_READING";
      id: string;
      passage: string;
      questionText: string;
      options: Option[];
    }
  | {
      kind: "MCM_READING";
      id: string;
      passage: string;
      questionText: string;
      options: Option[];
    }
  | { kind: "REORDER_PARAGRAPH"; id: string; boxes: ReorderBox[] }
  | {
      kind: "FIB_READING";
      id: string;
      parts: string[];
      wordBank: string[];
    }
  | {
      kind: "FIB_RW";
      id: string;
      parts: string[];
      /** `options: null` = no choices; the student types the word. */
      blanks: { options: string[] | null }[];
    }
  | { kind: "UNSUPPORTED"; id: string; type: QuestionType };

/** The gap markers `{{1}}`, `{{2}}`… carry no answer content, only where gaps are. */
const GAP = /\{\{\d+\}\}/;

/** Not cryptographic — display-order shuffling only. */
export function shuffled<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.item);
}

export function toClientQuestion(
  snapshot: QuestionSnapshot,
  shuffle: <T>(items: readonly T[]) => T[] = shuffled,
): ClientQuestion {
  const { id, type } = snapshot;

  switch (type) {
    case "MCS_READING": {
      const p = questionSchemas.MCS_READING.parse(snapshot.payload);
      return {
        kind: type,
        id,
        passage: p.passage,
        questionText: p.question,
        options: p.options.map((o) => ({ id: o.id, text: o.text })),
      };
    }
    case "MCM_READING": {
      const p = questionSchemas.MCM_READING.parse(snapshot.payload);
      return {
        kind: type,
        id,
        passage: p.passage,
        questionText: p.question,
        options: p.options.map((o) => ({ id: o.id, text: o.text })),
      };
    }
    case "REORDER_PARAGRAPH": {
      const p = questionSchemas.REORDER_PARAGRAPH.parse(snapshot.payload);
      return {
        kind: type,
        id,
        boxes: shuffle(p.boxes).map((text, index) => ({
          key: `box-${index}`,
          text,
        })),
      };
    }
    case "FIB_READING": {
      const p = questionSchemas.FIB_READING.parse(snapshot.payload);
      return {
        kind: type,
        id,
        parts: p.passage_with_blanks.split(GAP),
        wordBank: shuffle(p.word_bank),
      };
    }
    case "FIB_RW": {
      const p = questionSchemas.FIB_RW.parse(snapshot.payload);
      return {
        kind: type,
        id,
        parts: p.passage_with_blanks.split(GAP),
        blanks: p.blanks.map((blank) => ({ options: blank.options })),
      };
    }
    default:
      return { kind: "UNSUPPORTED", id, type };
  }
}
