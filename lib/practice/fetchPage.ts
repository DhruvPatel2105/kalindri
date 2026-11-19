/**
 * Paginated reads in ONE round trip instead of two: the total count and the
 * requested page run at the same time. Only when the requested page turns
 * out to be past the end (a stale or edited ?page=) is the page query re-run
 * for the last real page. No DB access of its own — callers pass the two
 * queries — so it is unit-tested with fakes.
 */

import { paginate, type Pagination } from "./questionList";

export async function fetchPage<T>(
  requestedPage: number,
  pageSize: number,
  countRows: () => Promise<number>,
  pageRows: (offset: number) => Promise<T[]>,
): Promise<{ total: number; pagination: Pagination; rows: T[] }> {
  const page = Math.max(1, Math.floor(requestedPage) || 1);
  const requestedOffset = (page - 1) * pageSize;
  const [total, firstTry] = await Promise.all([countRows(), pageRows(requestedOffset)]);
  const pagination = paginate(total, page, pageSize);
  const rows =
    pagination.offset === requestedOffset ? firstTry : await pageRows(pagination.offset);
  return { total, pagination, rows };
}
