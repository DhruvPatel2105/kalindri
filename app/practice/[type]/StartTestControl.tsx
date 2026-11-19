"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { clampCount } from "@/lib/practice/questionCount";

/**
 * "How many questions?" + Start, for the whole question bank of a type. The
 * student picks a number from 1 to the total; a test (or Practice) then has
 * that many questions, picked at random and kept in the bank's order.
 * Practice also gets a random seed so a refresh shows the same questions.
 */
export function StartTestControl({
  type,
  setId,
  total,
  defaultCount,
  mode = "test",
}: {
  type: string;
  setId: string;
  total: number;
  /** What the box starts with; the whole set (`total`) if omitted. */
  defaultCount?: number;
  /** "test" sits a scored test; "practice" opens the practice page. */
  mode?: "test" | "practice";
}) {
  const router = useRouter();
  const [text, setText] = useState(String(Math.min(Math.max(1, defaultCount ?? total), total)));
  // True from the click until the test page has loaded: the button shows
  // "Starting…" and can't be pressed again, so one click is one test.
  const [isPending, startTransition] = useTransition();

  const parsed = /^\d+$/.test(text) ? Number(text) : undefined;
  const count = clampCount(parsed, total);
  const valid = parsed !== undefined && parsed >= 1;

  function start() {
    if (!valid || isPending) return;
    const seed = Math.random().toString(36).slice(2, 10);
    // A whole-bank test needs no parameter.
    const href =
      mode === "practice"
        ? `/practice/${type}/learn/${setId}?count=${count}&s=${seed}`
        : count >= total
          ? `/practice/${type}/${setId}`
          : `/practice/${type}/${setId}?count=${count}`;
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
        {isPending ? "Starting…" : mode === "practice" ? "Start practice" : "Start test"}
      </button>
    </form>
  );
}
