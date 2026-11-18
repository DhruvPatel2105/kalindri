import Link from "next/link";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getHistoryPage } from "@/lib/practice/listHistory";
import { parsePageParam } from "@/lib/practice/questionList";
import { fillHistorySummaries } from "@/lib/practice/loadFinished";

import { HistoryList } from "../HistoryList";
import { Pagination } from "../Pagination";

/**
 * Every practice test the student has started, newest first — each a
 * separate saved session, retakes and retries included, never merged or
 * overwritten. It's all stored on their account, so it's here after
 * refreshing or logging out and back in. Finished tests link to their saved
 * results and answer review; unfinished ones resume where they left off.
 */
export default async function PracticeHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page: pageParam } = await searchParams;
  const user = await requireActiveSession();

  const { total, pagination, items } = await getHistoryPage(getDb(), {
    userId: user.id,
    requestedPage: parsePageParam(pageParam),
  });

  const rows = await fillHistorySummaries(user, items);

  const pageHref = (n: number) =>
    n === 1 ? "/practice/history" : `/practice/history?page=${n}`;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/" className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]">
            ← Dashboard
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">Practice history</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">Practice history</h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            {total === 0
              ? "You haven't started a practice test yet."
              : `${total} ${total === 1 ? "test" : "tests"}, newest first. Each attempt is saved separately, so retakes never replace an earlier result.`}
          </p>
        </div>

        {rows.length > 0 ? <HistoryList items={rows} /> : null}

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          hrefFor={pageHref}
        />

        <p className="text-xs text-[#7d8a88]">
          Marks are raw marks for each set — not a PTE score or a CLB level.
        </p>
      </main>
    </div>
  );
}
