"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { clampCount } from "@/lib/practice/questionCount";

/**
 * "How many questions?" + Start test, for one set. The student picks a number
 * from 1 to the set's total (the whole set by default); the test then has that
 * many questions, picked at random from the set and kept in the set's order.
 */
export function StartTestControl({
  type,
  setId,
  total,
}: {
  type: string;
  setId: string;
  total: number;
}) {
  const router = useRouter();
  const [text, setText] = useState(String(total));
  // True from the click until the test page has loaded: the button shows
  // "Starting…" and can't be pressed again, so one click is one test.
  const [isPending, startTransition] = useTransition();

  const parsed = /^\d+$/.test(text) ? Number(text) : undefined;
  const count = clampCount(parsed, total);
  const valid = parsed !== undefined && parsed >= 1;

  function start() {
    if (!valid || isPending) return;
    // The whole set needs no parameter.
    const href =
      count >= total ? `/practice/${type}/${setId}` : `/practice/${type}/${setId}?count=${count}`;
    startTransition(() => router.push(href));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
      className="flex shrink-0 items-center gap-2"
    >
      <label className="flex items-center gap-1.5 text-xs text-[#5c6a68]">
        <span className="sr-only">Number of questions</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isPending}
          onBlur={() => setText(String(valid ? count : total))}
          aria-label={`Number of questions, 1 to ${total}`}
          className="w-14 rounded border border-[#cfccc2] bg-white px-2 py-1.5 text-center text-sm text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
        />
        <span>of {total}</span>
      </label>
      <button
        type="submit"
        disabled={!valid || isPending}
        aria-busy={isPending}
        className="rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-50"
      >
        {isPending ? "Starting…" : "Start test"}
      </button>
    </form>
  );
}
