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
