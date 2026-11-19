/**
 * MCM_READING (multiple answers) and MCS_READING (single answer) importer format:
 *
 *   #1 Title
 *   Passage lines (any number; they are joined into one paragraph).
 *   The question — the LAST line before the first option.
 *   * A) First option
 *   * B) Second option ✓
 *   * C) Third option ✓
 *   Answer: B, C
 *
 * Mark each correct option with ✓ and/or give the `Answer:` line; when both
 * are present they must agree, so a slip in either is caught instead of
 * silently storing a wrong key. Option letters become the option ids
 * (a, b, c, ...); the "* " bullet is optional and both "A)" and "A." work.
 * Option order is kept as written (letters are part of the question).
 * For the single-answer type (MCS) exactly ONE option may be correct.
 */

import { mcmReadingSchema, type McmReadingPayload } from "@/lib/questions/schemas/mcm-reading";
import { mcsReadingSchema, type McsReadingPayload } from "@/lib/questions/schemas/mcs-reading";

import {
  joinLines,
  splitBlocks,
  type ParsedFile,
  type ParsedQuestion,
  type RawBlock,
} from "./blocks";

const OPTION = /^[*-]?\s*([A-Za-z])[).]\s+(.*?)\s*(✓)?\s*$/;
const ANSWER = /^answers?\s*:\s*(.*)$/i;

function parseChoiceBlock<P>(block: RawBlock, single: boolean): ParsedQuestion<P> {
  const errors: string[] = [];
  const fail = (): ParsedQuestion<P> => ({
    ok: false,
    number: block.number,
    title: block.title,
    errors,
  });

  const lines = block.lines.filter((line) => line.trim() !== "");
  const firstOption = lines.findIndex((line) => OPTION.test(line.trim()));
  if (firstOption < 2) {
    errors.push(
      firstOption === -1
        ? 'No options found — write each as "* A) text" (add ✓ to correct ones).'
        : "Needs a passage and a question line before the first option.",
    );
    return fail();
  }

  const question = (lines[firstOption - 1] ?? "").trim();
  const passage = joinLines(lines.slice(0, firstOption - 1));

  const options: { id: string; text: string }[] = [];
  const ticked: string[] = [];
  let answerLine: string | null = null;
  for (const raw of lines.slice(firstOption)) {
    const line = raw.trim();
    const answer = ANSWER.exec(line);
    if (answer) {
      answerLine = answer[1] ?? "";
      continue;
    }
    const option = OPTION.exec(line);
    if (!option) {
      errors.push(`Unrecognised line after the options: "${line.slice(0, 60)}".`);
      continue;
    }
    const id = (option[1] ?? "").toLowerCase();
    if (options.some((o) => o.id === id)) errors.push(`Option ${id.toUpperCase()} appears more than once.`);
    options.push({ id, text: (option[2] ?? "").trim() });
    if (option[3]) ticked.push(id);
  }

  let correct = ticked;
  if (answerLine !== null) {
    const fromAnswer = answerLine
      .split(/[,\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part !== "");
    const sameSet =
      fromAnswer.length === new Set(fromAnswer).size &&
      [...fromAnswer].sort().join() === [...ticked].sort().join();
    if (ticked.length > 0 && !sameSet) {
      errors.push(
        `The ✓ marks (${ticked.join(", ").toUpperCase() || "none"}) and the Answer line (${fromAnswer.join(", ").toUpperCase() || "none"}) disagree.`,
      );
    }
    correct = ticked.length > 0 ? ticked : fromAnswer;
  }
  if (correct.length === 0) errors.push("No correct options — add ✓ marks or an Answer: line.");
  if (single && correct.length > 1) {
    errors.push(`Single-answer question has ${correct.length} correct options (${correct.join(", ").toUpperCase()}) — exactly one is allowed.`);
  }
  if (errors.length > 0) return fail();

  const parsed = single
    ? mcsReadingSchema.safeParse({ passage, question, options, correct_option_id: correct[0] })
    : mcmReadingSchema.safeParse({ passage, question, options, correct_option_ids: correct });
  if (!parsed.success) {
    errors.push(...parsed.error.issues.map((issue) => issue.message));
    return fail();
  }
  return {
    ok: true,
    number: block.number,
    title: block.title,
    difficulty: block.difficulty,
    payload: parsed.data as P,
  };
}

export function parseMcmFile(text: string): ParsedFile<McmReadingPayload> {
  const { blocks, errors } = splitBlocks(text);
  return { items: blocks.map((block) => parseChoiceBlock<McmReadingPayload>(block, false)), fileErrors: errors };
}

export function parseMcsFile(text: string): ParsedFile<McsReadingPayload> {
  const { blocks, errors } = splitBlocks(text);
  return { items: blocks.map((block) => parseChoiceBlock<McsReadingPayload>(block, true)), fileErrors: errors };
}
