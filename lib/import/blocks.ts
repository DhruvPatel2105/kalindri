/**
 * Shared helpers for the bulk question importer (lib/db/importQuestions.ts).
 * Pure — no DB, no file access — so every parser built on them is unit-tested.
 *
 * Source files are plain text, one question per block. A block starts with a
 * header line `#<number> <title>` and runs until the next header. Lines
 * starting with `//` are comments and ignored, so templates can document
 * themselves.
 */

export interface RawBlock {
  number: number;
  title: string;
  /** Body lines, comments removed, leading/trailing blank lines trimmed. */
  lines: string[];
}

export interface SplitResult {
  blocks: RawBlock[];
  /** File-level problems (content before the first header, duplicate numbers). */
  errors: string[];
}

const HEADER_PATTERN = /^#\s*(\d+)\s*(.*)$/;

export function splitBlocks(text: string): SplitResult {
  const blocks: RawBlock[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  let current: RawBlock | null = null;

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith("//")) continue;

    const header = HEADER_PATTERN.exec(line.trim());
    if (header) {
      const number = Number(header[1]);
      if (seen.has(number)) {
        errors.push(`Question #${number} appears more than once.`);
      }
      seen.add(number);
      current = { number, title: (header[2] ?? "").trim(), lines: [] };
      blocks.push(current);
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else if (line.trim() !== "") {
      errors.push(
        `Found text before the first "#<number> <title>" header: "${line.trim().slice(0, 60)}"`,
      );
    }
  }

  for (const block of blocks) {
    while (block.lines.length > 0 && block.lines[0]?.trim() === "") {
      block.lines.shift();
    }
    while (
      block.lines.length > 0 &&
      block.lines[block.lines.length - 1]?.trim() === ""
    ) {
      block.lines.pop();
    }
  }

  return { blocks, errors };
}

export interface ExtractedBlanks {
  /** Passage with each `[...]` replaced by `{{1}}`, `{{2}}`, ... in order. */
  passage: string;
  /** Trimmed text inside each `[...]`, in order. */
  contents: string[];
  /** True if a `[` or `]` is left over (unbalanced or nested brackets). */
  hasStrayBracket: boolean;
}

export function extractBlanks(text: string): ExtractedBlanks {
  const contents: string[] = [];
  let count = 0;
  const passage = text.replace(/\[([^[\]]*)\]/g, (_match, inner: string) => {
    contents.push(inner.trim());
    count++;
    return `{{${count}}}`;
  });
  return { passage, contents, hasStrayBracket: /[[\]]/.test(passage) };
}

/** Joins wrapped lines into one paragraph with single spaces. */
export function joinLines(lines: readonly string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

/** Case-insensitive duplicates in a list, each reported once. */
export function findDuplicates(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Map<string, string>();
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key) && !dupes.has(key)) dupes.set(key, word);
    seen.add(key);
  }
  return [...dupes.values()];
}

/** The shape every per-type parser returns for one question. */
export type ParsedQuestion<P> =
  | { ok: true; number: number; title: string; payload: P }
  | { ok: false; number: number; title: string; errors: string[] };

export interface ParsedFile<P> {
  items: ParsedQuestion<P>[];
  fileErrors: string[];
}
