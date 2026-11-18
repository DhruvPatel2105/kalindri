import Link from "next/link";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getHistoryPage } from "@/lib/practice/listHistory";
import { parsePageParam } from "@/lib/practice/questionList";
import { getTestResults } from "@/lib/practice/testEngine";
import { formatDuration } from "@/lib/practice/testState";

import { LocalTime } from "../LocalTime";
import { Pagination } from "../Pagination";
import { TYPE_LABELS } from "../[type]/typeLabels";

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

  // A finished test saved before result summaries existed (or whose marking
  // was still pending) has none stored yet: compute it now. Doing so also
  // stores it for next time.
  const rows = await Promise.all(
    items.map(async (item) => {
      if (item.status !== "completed" || item.summary) return item;
      try {
        return { ...item, summary: (await getTestResults(user, item.sessionId)).summary };
      } catch {
        return item;
      }
    }),
  );

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

        {rows.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {rows.map((item) => {
              const { summary } = item;
              const done = item.status === "completed";
              const base = `/practice/${item.type}/${item.setId}`;
              const elapsed =
                done && item.completedAt
                  ? formatDuration(item.completedAt.getTime() - item.startedAt.getTime())
                  : null;
              return (
                <li
                  key={item.sessionId}
                  className="flex flex-col gap-3 rounded-lg border border-[#ddd9d0] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1e2a2a]">
                      {item.isRetry ? `${item.label} — ` : ""}
                      {item.setTitle}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5c6a68]">
                      <span>{TYPE_LABELS[item.type] ?? item.type}</span>
                      <span aria-hidden="true">·</span>
                      <LocalTime iso={item.startedAt.toISOString()} />
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.questionCount} {item.questionCount === 1 ? "question" : "questions"}
                      </span>
                      {elapsed ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{elapsed}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-none items-center gap-3">
                    {done ? (
                      <span className="text-sm font-semibold text-[#1e2a2a]">
                        {summary
                          ? `${summary.score}/${summary.maxScore}${summary.percent !== null ? ` · ${summary.percent}%` : ""}`
                          : "—"}
                      </span>
                    ) : (
                      <span className="rounded bg-[#fbf3e3] px-2 py-0.5 text-xs font-medium text-[#8a6a1e]">
                        In progress
                      </span>
                    )}
                    <Link
                      href={
                        done
                          ? `${base}/results/${item.sessionId}`
                          : item.isRetry
                            ? `${base}/session/${item.sessionId}`
                            : base
                      }
                      className="rounded border border-[#dcd8cf] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
                    >
                      {done ? "View results" : "Continue"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

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
