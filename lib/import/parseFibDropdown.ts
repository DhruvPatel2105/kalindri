/**
 * FIB_RW (dropdown per blank) importer format:
 *
 *   #1 Title
 *   Passage with each blank written as [correct | wrong1 | wrong2 | wrong3].
 *
 * Exactly 4 options per blank, and the FIRST one is the correct answer —
 * unlike the drag type, every blank has its OWN list of choices. The correct
 * option is shuffled into a random position on import so the stored order
 * never gives it away. A blank written as just [word] (no wrong options) is
 * reported as an error naming the blank, since the schema needs all 4.
 */

import { fibRwSchema, type FibRwPayload } from "@/lib/questions/schemas/fib-rw";

import {
  extractBlanks,
  findDuplicates,
  joinLines,
  splitBlocks,
  type ParsedFile,
  type ParsedQuestion,
  type RawBlock,
} from "./blocks";

const OPTIONS_PER_BLANK = 4;

/** Shuffle by random sort keys; `random` is injectable so tests are deterministic. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

function parseBlock(
  block: RawBlock,
  random: () => number,
): ParsedQuestion<FibRwPayload> {
  const errors: string[] = [];
  const { passage, contents, hasStrayBracket } = extractBlanks(
    joinLines(block.lines),
  );

  if (contents.length === 0) {
    errors.push(
      "No blanks found — write each blank like [correct | wrong | wrong | wrong].",
    );
  }
  if (hasStrayBracket) {
    errors.push('Unbalanced or nested "[" / "]" in the passage.');
  }

  const blanks: FibRwPayload["blanks"] = [];
  contents.forEach((content, i) => {
    const blankNumber = i + 1;
    const options = content
      .split("|")
      .map((option) => option.trim())
      .filter((option) => option !== "");

    if (options.length !== OPTIONS_PER_BLANK) {
      errors.push(
        `Blank ${blankNumber} has ${options.length} option(s) ("${content}") — needs exactly ${OPTIONS_PER_BLANK}: the correct one first, then 3 wrong ones.`,
      );
      return;
    }
    const duplicates = findDuplicates(options);
    if (duplicates.length > 0) {
      errors.push(
        `Blank ${blankNumber} repeats option(s): ${duplicates.join(", ")}.`,
      );
      return;
    }
    blanks.push({
      index: blankNumber,
      options: shuffle(options, random),
      correct_option: options[0] ?? "",
    });
  });

  if (errors.length > 0) {
    return { ok: false, number: block.number, title: block.title, errors };
  }

  const parsed = fibRwSchema.safeParse({ passage_with_blanks: passage, blanks });
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

export function parseFibDropdownFile(
  text: string,
  random: () => number = Math.random,
): ParsedFile<FibRwPayload> {
  const { blocks, errors } = splitBlocks(text);
  return {
    items: blocks.map((block) => parseBlock(block, random)),
    fileErrors: errors,
  };
}
