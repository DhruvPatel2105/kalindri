/**
 * FIB_READING (drag from a word bank) importer format:
 *
 *   #1 Title
 *   Passage text with the correct words in [square brackets] where blanks go.
 *   Unused: wrong1, wrong2, wrong3
 *
 * Each `[word]` becomes a numbered blank (`{{1}}`, `{{2}}`, ...) and its
 * word is the correct answer for that blank, in order. The word bank is the
 * correct answers plus the `Unused:` distractors. Every question must have
 * at least one distractor — more words than gaps is what this type tests —
 * and no word may appear twice in the bank (the drag UI identifies words by
 * their text, so a duplicate would behave as one word).
 */

import {
  fibReadingSchema,
  type FibReadingPayload,
} from "@/lib/questions/schemas/fib-reading";

import {
  extractBlanks,
  findDuplicates,
  joinLines,
  splitBlocks,
  type ParsedFile,
  type ParsedQuestion,
  type RawBlock,
} from "./blocks";

const UNUSED_PATTERN = /^\s*Unused\s*:\s*(.*)$/i;

function parseBlock(block: RawBlock): ParsedQuestion<FibReadingPayload> {
  const errors: string[] = [];
  const textLines: string[] = [];
  let unusedText: string | null = null;

  for (const line of block.lines) {
    const unused = UNUSED_PATTERN.exec(line);
    if (unused) {
      unusedText = unused[1] ?? "";
    } else {
      textLines.push(line);
    }
  }

  const { passage, contents, hasStrayBracket } = extractBlanks(
    joinLines(textLines),
  );

  if (contents.length === 0) {
    errors.push("No blanks found — mark each answer like [word] in the passage.");
  }
  if (hasStrayBracket) {
    errors.push('Unbalanced or nested "[" / "]" in the passage.');
  }
  contents.forEach((word, index) => {
    if (word === "") errors.push(`Blank ${index + 1} is empty: [].`);
  });

  if (unusedText === null) {
    errors.push('Missing an "Unused: word, word, ..." line.');
  }
  const unused = (unusedText ?? "")
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word !== "");
  if (unusedText !== null && unused.length === 0) {
    errors.push("The Unused: line has no words — at least one distractor is required.");
  }

  const wordBank = [...contents, ...unused];
  const duplicates = findDuplicates(wordBank);
  if (duplicates.length > 0) {
    errors.push(
      `Word bank has duplicate word(s): ${duplicates.join(", ")}. Each word may appear only once (answers + unused combined).`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, number: block.number, title: block.title, errors };
  }

  const parsed = fibReadingSchema.safeParse({
    passage_with_blanks: passage,
    word_bank: wordBank,
    correct_answers: contents,
  });
  if (!parsed.success) {
    return {
      ok: false,
      number: block.number,
      title: block.title,
      errors: parsed.error.issues.map((i) => i.message),
    };
  }
  return {
    ok: true,
    number: block.number,
    title: block.title,
    difficulty: block.difficulty,
    payload: parsed.data,
  };
}

export function parseFibDragFile(text: string): ParsedFile<FibReadingPayload> {
  const { blocks, errors } = splitBlocks(text);
  return { items: blocks.map(parseBlock), fileErrors: errors };
}
