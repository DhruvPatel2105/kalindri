"use client";

import { memo, useEffect, useRef, useState } from "react";

import type { BookmarkColor } from "@/lib/practice/bookmarkColors";
import {
  DIFFICULTY_LABELS,
  PAGE_SIZE,
  pageNumbers,
  paginate,
  pageOfIndex,
  type Difficulty,
} from "@/lib/practice/questionList";
import type { QuestionResultKind } from "@/lib/practice/testResults";

import { BookmarkIcon, choiceFor } from "../../BookmarkButton";

export interface DrawerQuestion {
  number: number;
  header: string;
  difficulty: Difficulty | null;
  /** How the latest attempt went; null if never attempted. */
  kind: QuestionResultKind | null;
  bookmark: BookmarkColor | null;
}

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  easy: "border-[#1f6f6b] text-[#1f6f6b]",
  medium: "border-[#c47b1e] text-[#c47b1e]",
  hard: "border-[#b0472f] text-[#b0472f]",
};
const KIND_LABEL: Partial<Record<QuestionResultKind, { text: string; tone: string }>> = {
  correct: { text: "Correct", tone: "bg-[#eaf2f1] text-[#17544f]" },
  partial: { text: "Partly correct", tone: "bg-[#fbf3e3] text-[#8a6a1e]" },
  incorrect: { text: "Incorrect", tone: "bg-[#fdf2f0] text-[#b0472f]" },
};

/**
 * A button fixed to the middle of the right edge that slides out a panel of
 * every question in the set — number, header, difficulty, whether you've done
 * it and how it went, and its bookmark — 10 per page. Picking one jumps to it.
 */
export const QuestionListDrawer = memo(function QuestionListDrawer({
  questions,
  currentIndex,
  onSelect,
}: {
  questions: DrawerQuestion[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  const pagination = paginate(questions.length, page, PAGE_SIZE);
  const visible = questions.slice(pagination.offset, pagination.offset + PAGE_SIZE);

  function openDrawer() {
    // Open on the page that holds the question being worked on.
    setPage(pageOfIndex(currentIndex));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Show all questions"
        title="All questions"
        className="fixed right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 translate-x-1/3 items-center justify-center rounded-full bg-[#1f6f6b] pr-3 text-white shadow-lg hover:bg-[#17544f]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="All questions"
            className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#e6e2d9] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#1e2a2a]">All questions</h2>
                <p className="text-xs text-[#7d8a88]">{questions.length} questions in this set</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded border border-[#dcd8cf] px-3 py-1.5 text-sm text-[#1e2a2a] hover:border-[#1f6f6b]"
              >
                ✕
              </button>
            </div>

            <ul className="flex-1 overflow-y-auto">
              {visible.map((q) => {
                const index = q.number - 1;
                const kind = q.kind ? KIND_LABEL[q.kind] : undefined;
                const mark = choiceFor(q.bookmark);
                return (
                  <li key={q.number} className="border-b border-[#f0ede5]">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(index);
                        setOpen(false);
                      }}
                      aria-current={index === currentIndex ? "true" : undefined}
                      className={`flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[#fafaf8] ${
                        index === currentIndex ? "bg-[#f4faf9]" : ""
                      }`}
                    >
                      <span className="w-9 flex-none text-sm font-semibold text-[#1f6f6b]">#{q.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1e2a2a]">{q.header}</span>
                      {q.difficulty ? (
                        <span className={`flex-none rounded border px-1.5 py-0.5 text-[11px] font-medium ${DIFFICULTY_STYLES[q.difficulty]}`}>
                          {DIFFICULTY_LABELS[q.difficulty]}
                        </span>
                      ) : null}
                      <span
                        className={`flex-none rounded px-2 py-0.5 text-[11px] font-medium ${
                          kind ? kind.tone : "bg-[#eceae4] text-[#7d8a88]"
                        }`}
                      >
                        {kind ? kind.text : q.kind === "unanswered" || q.kind === null ? "Undone" : "Done"}
                      </span>
                      <span title={q.bookmark ? `Bookmarked ${mark.label.toLowerCase()}` : "Not bookmarked"}>
                        <BookmarkIcon fill={mark.fill} stroke={mark.stroke} size={14} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {pagination.totalPages > 1 ? (
              <nav aria-label="Question pages" className="flex flex-wrap items-center justify-center gap-1.5 border-t border-[#e6e2d9] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded border border-[#ddd9d0] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                {pageNumbers(pagination.page, pagination.totalPages).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === pagination.page ? "page" : undefined}
                    className={`rounded border px-3 py-1.5 text-sm ${
                      n === pagination.page
                        ? "border-[#1f6f6b] bg-[#1f6f6b] font-semibold text-white"
                        : "border-[#ddd9d0] bg-white text-[#1e2a2a] hover:border-[#1f6f6b]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded border border-[#ddd9d0] px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
});
