/**
 * REORDER_PARAGRAPH importer format:
 *
 *   #1 Title
 *   Answer: 1, 3, 2, 4
 *   1. First sentence as listed (scrambled) in the source.
 *   2. Second sentence...
 *   3. ...
 *
 * The answer is the READING ORDER of the listed sentences: "1, 3, 2, 4"
 * means read sentence 1 first, then 3, then 2, then 4. The stored payload
 * (`boxes`) is the sentences already in that correct order, which is what
 * the scorer and schema expect — so the conversion happens here.
 *
 * Tolerant of how this tends to get pasted: `Answer:` may sit on the header
 * line or its own line, a trailing `]` is ignored, and a sentence wrapped
 * over several lines is joined.
 */

import {
  reorderParagraphSchema,
  type ReorderParagraphPayload,
} from "@/lib/questions/schemas/reorder-paragraph";

import {
  joinLines,
  splitBlocks,
  type ParsedFile,
  type ParsedQuestion,
  type RawBlock,
} from "./blocks";

const ANSWER_PATTERN = /Answer\s*:\s*([\d\s,]+)\]?/i;
const SENTENCE_PATTERN = /^\s*(\d+)\s*[.)]\s*(.*)$/;

function parseBlock(block: RawBlock): ParsedQuestion<ReorderParagraphPayload> {
  const errors: string[] = [];
  let title = block.title;
  let answerText: string | null = null;

  const headerMatch = ANSWER_PATTERN.exec(title);
  if (headerMatch) {
    answerText = headerMatch[1] ?? null;
    title = title.replace(ANSWER_PATTERN, "").trim();
  }

  const sentenceLines: { number: number; parts: string[] }[] = [];
  for (const line of block.lines) {
    if (line.trim() === "") continue;

    const answerInLine = ANSWER_PATTERN.exec(line);
    if (answerInLine) {
      answerText = answerInLine[1] ?? null;
      continue;
    }

    const sentence = SENTENCE_PATTERN.exec(line);
    if (sentence) {
      sentenceLines.push({
        number: Number(sentence[1]),
        parts: [sentence[2] ?? ""],
      });
    } else {
      const last = sentenceLines[sentenceLines.length - 1];
      if (last) last.parts.push(line);
      else errors.push(`Unexpected line before the first sentence: "${line.trim().slice(0, 50)}"`);
    }
  }

  const sentences = sentenceLines.map((s) => joinLines(s.parts));

  sentenceLines.forEach((s, index) => {
    if (s.number !== index + 1) {
      errors.push(
        `Sentences must be numbered 1, 2, 3... in order; found ${s.number} in position ${index + 1}.`,
      );
    }
  });
  if (sentences.length < 2) {
    errors.push(`Needs at least 2 sentences; found ${sentences.length}.`);
  }
  if (sentences.some((s) => s === "")) {
    errors.push("A numbered sentence is empty.");
  }

  let order: number[] = [];
  if (answerText === null) {
    errors.push('Missing an "Answer: 1, 3, 2, 4" line.');
  } else {
    order = answerText
      .split(/[\s,]+/)
      .filter((part) => part !== "")
      .map(Number);
    const isPermutation =
      order.length === sentences.length &&
      order.every((n) => Number.isInteger(n)) &&
      new Set(order).size === order.length &&
      order.every((n) => n >= 1 && n <= sentences.length);
    if (!isPermutation) {
      errors.push(
        `Answer "${order.join(", ")}" must use each of 1..${sentences.length} exactly once.`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, number: block.number, title, errors };
  }

  const boxes = order.map((n) => sentences[n - 1] ?? "");
  const parsed = reorderParagraphSchema.safeParse({ boxes });
  if (!parsed.success) {
    return {
      ok: false,
      number: block.number,
      title,
      errors: parsed.error.issues.map((i) => i.message),
    };
  }
  return { ok: true, number: block.number, title, payload: parsed.data };
}

export function parseReorderFile(
  text: string,
): ParsedFile<ReorderParagraphPayload> {
  const { blocks, errors } = splitBlocks(text);
  return { items: blocks.map(parseBlock), fileErrors: errors };
}
