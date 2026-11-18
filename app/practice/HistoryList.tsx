import Link from "next/link";

import type { HistoryItem } from "@/lib/practice/listHistory";
import { formatDuration } from "@/lib/practice/testState";

import { LocalTime } from "./LocalTime";
import { TYPE_LABELS } from "./[type]/typeLabels";

/**
 * Rows of saved practice sessions: title, type, date, size, time taken and
 * marks, with View results (finished) or Continue (unfinished). Used by the
 * practice history page and each question type's progress dashboard.
 */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
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
  );
}
