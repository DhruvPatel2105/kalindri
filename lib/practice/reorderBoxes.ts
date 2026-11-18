/**
 * Pure helpers for the Reorder Paragraph answer input. Kept apart from
 * clientQuestion.ts so the client component doesn't pull the question schemas
 * into the browser bundle.
 */

export interface ReorderBox {
  key: string;
  text: string;
}

/**
 * Splits the boxes into the ones the student has placed (in their order) and
 * the ones still waiting, given their saved response — the box TEXTS in
 * order. Matching is by text, using each box at most once, so a restored
 * answer works even though the keys are regenerated on every page load.
 */
export function splitReorderBoxes(
  boxes: readonly ReorderBox[],
  value: readonly string[],
): { source: ReorderBox[]; target: ReorderBox[] } {
  const remaining = [...boxes];
  const target: ReorderBox[] = [];
  for (const text of value) {
    const at = remaining.findIndex((box) => box.text === text);
    if (at !== -1) target.push(...remaining.splice(at, 1));
  }
  return { source: remaining, target };
}
