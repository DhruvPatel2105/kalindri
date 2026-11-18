/**
 * Pure helpers for the question-set browse page (/practice/[type]). No DB
 * access — the page and lib/practice/listQuestionSets.ts feed these.
 *
 * CLAUDE.md content protection: this page lists METADATA only (id, title,
 * difficulty, question count). Passage text, options and answer keys never go
 * into a list.
 */

export const PAGE_SIZE = 10;

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** The 1-based page that holds the item at 0-based `index`, for pages of `pageSize`. */
export function pageOfIndex(index: number, pageSize: number = PAGE_SIZE): number {
  if (!Number.isInteger(index) || index < 0) return 1;
  return Math.floor(index / pageSize) + 1;
}

export interface DifficultyMix {
  easy: number;
  medium: number;
  hard: number;
  unrated: number;
}

/** Counts a list of question difficulties (null = not rated yet). */
export function countDifficulties(difficulties: readonly (Difficulty | null)[]): DifficultyMix {
  const mix: DifficultyMix = { easy: 0, medium: 0, hard: 0, unrated: 0 };
  for (const d of difficulties) mix[d ?? "unrated"] += 1;
  return mix;
}

export type SetDifficulty =
  | { kind: "single"; difficulty: Difficulty }
  | { kind: "mixed" }
  | { kind: "unrated" };

/**
 * What difficulty tag a set shows. The set's own rating wins if it has one;
 * otherwise it is judged from its questions: all rated the same → that
 * difficulty, rated differently → "mixed", none rated → "unrated". Questions
 * with no rating don't make a set "mixed" (they are still in the breakdown).
 */
export function describeSetDifficulty(
  setDifficulty: Difficulty | null,
  mix: DifficultyMix,
): SetDifficulty {
  if (setDifficulty) return { kind: "single", difficulty: setDifficulty };
  const present = (["easy", "medium", "hard"] as const).filter((d) => mix[d] > 0);
  if (present.length === 0) return { kind: "unrated" };
  if (present.length === 1 && present[0]) return { kind: "single", difficulty: present[0] };
  return { kind: "mixed" };
}

/** "4 easy · 9 medium · 5 hard · 3 unrated" — only the parts that are present. */
export function difficultyBreakdown(mix: DifficultyMix): string {
  return (["easy", "medium", "hard", "unrated"] as const)
    .filter((d) => mix[d] > 0)
    .map((d) => `${mix[d]} ${d}`)
    .join(" · ");
}

/** `?page=` as a positive integer; anything missing, malformed or < 1 is page 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && Number.isSafeInteger(page) ? page : 1;
}

export interface Pagination {
  /** The page actually shown — the request clamped into 1..totalPages. */
  page: number;
  totalPages: number;
  /** Rows to skip in the query. */
  offset: number;
}

export function paginate(
  total: number,
  requestedPage: number,
  pageSize: number = PAGE_SIZE,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return { page, totalPages, offset: (page - 1) * pageSize };
}

/**
 * Page buttons to render: a window of up to `maxButtons` consecutive pages
 * containing the current page (so 1..5 for early pages, the last 5 for late
 * ones, and centred in between).
 */
export function pageNumbers(
  page: number,
  totalPages: number,
  maxButtons = 5,
): number[] {
  const count = Math.min(maxButtons, totalPages);
  let start = Math.max(1, page - Math.floor(count / 2));
  start = Math.min(start, totalPages - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}

/** "Total questions in the set": "15 questions", "1 question". */
export function questionCountLabel(count: number): string {
  return `${count} question${count === 1 ? "" : "s"}`;
}
