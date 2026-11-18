/**
 * The one-line header shown on a collapsed Practice card, built only from the
 * browser-safe question (ClientQuestion), so it can never reveal an answer or
 * the true order of a reorder question. Pure.
 */

import type { ClientQuestion } from "./clientQuestion";

const MAX = 90;

function clip(text: string, max = MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function questionHeader(question: ClientQuestion): string {
  switch (question.kind) {
    case "MCS_READING":
    case "MCM_READING":
      return clip(question.questionText) || "Multiple choice question";
    case "FIB_RW":
    case "FIB_READING": {
      // The text before the first blank — carries no answer content.
      const lead = clip(question.parts[0] ?? "");
      const base = question.kind === "FIB_RW" ? "Fill in the blanks" : "Fill in the blanks (word bank)";
      return lead ? `${base}: ${lead}…` : base;
    }
    case "REORDER_PARAGRAPH":
      return `Reorder ${question.boxes.length} sentences`;
    default:
      return "Question";
  }
}
