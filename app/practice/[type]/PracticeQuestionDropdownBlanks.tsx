"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

export function PracticeQuestionDropdownBlanks({
  sessionId,
  parts,
  blanks,
}: {
  sessionId: string;
  parts: string[];
  blanks: { options: string[] }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelect(blankIndex: number, value: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (value) {
        next[blankIndex] = value;
      } else {
        delete next[blankIndex];
      }
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const response = blanks.map((_, i) => selected[i] ?? "");
        const outcome = await submitAttempt(sessionId, response);
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  function handleNextQuestion() {
    setSelected({});
    setResult(null);
    setError(null);
    router.refresh();
  }

  const wordResults =
    result?.scored && result.result && "words" in result.result
      ? result.result.words
      : null;

  const score = result?.result?.score ?? 0;
  const maxScore = result?.result?.maxScore ?? blanks.length;
  const allCorrect = score === maxScore;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        Below is a text with blanks. Click on each blank, a list of choices
        will appear. Select the appropriate answer choice for each blank.
      </p>

      {/* ── passage with inline dropdowns ── */}
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-7 py-6">
        <p className="text-base leading-loose text-[#283634]">
          {parts.map((text, i) => {
            const blank = blanks[i];
            const wordResult = wordResults?.[i];
            return (
              <span key={i}>
                {text}
                {blank ? (
                  <select
                    value={selected[i] ?? ""}
                    disabled={Boolean(result)}
                    onChange={(e) => handleSelect(i, e.target.value)}
                    className={`mx-1.5 inline-block rounded border px-2 py-1 align-middle text-sm ${
                      result
                        ? wordResult?.correct
                          ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#17544f]"
                          : "border-[#b0472f] bg-[#fdf2f0] text-[#b0472f]"
                        : selected[i]
                          ? "cursor-pointer border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                          : "cursor-pointer border-[#a9c4c1] bg-white text-[#7d8a88]"
                    }`}
                  >
                    <option value="">— select —</option>
                    {blank.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {/* ── pre-submit footer ── */}
      {!result ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            One mark per blank. Read the whole sentence before choosing —
            several options fit the grammar but not the meaning.
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-fit flex-none rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        /* ── results panel ── */
        <div className="flex flex-col gap-4 rounded border border-[#ddd9d0] bg-white p-5">

          {/* score header */}
          <div className="flex items-center gap-3 border-b border-[#f0ede5] pb-4">
            <span
              className={`text-2xl font-bold ${allCorrect ? "text-[#1f6f6b]" : score === 0 ? "text-[#b0472f]" : "text-[#1e2a2a]"}`}
            >
              {score}/{maxScore}
            </span>
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                allCorrect
                  ? "bg-[#eaf2f1] text-[#17544f]"
                  : score === 0
                    ? "bg-[#fdf2f0] text-[#b0472f]"
                    : "bg-[#fbf3e3] text-[#8a6a1e]"
              }`}
            >
              {allCorrect
                ? "Perfect"
                : score === 0
                  ? "All incorrect"
                  : `${maxScore - score} mistake${maxScore - score === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* per-blank answer rows */}
          {wordResults ? (
            <div className="flex flex-col gap-2">
              {wordResults.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded border px-4 py-3 text-sm ${
                    w.correct
                      ? "border-[#bcd6d3] bg-[#f4faf9]"
                      : "border-[#e8c4bc] bg-[#fdf6f5]"
                  }`}
                >
                  {/* index + tick/cross */}
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
                      w.correct
                        ? "bg-[#1f6f6b] text-white"
                        : "bg-[#b0472f] text-white"
                    }`}
                  >
                    {w.correct ? "✓" : "✗"}
                  </span>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">
                      Blank {i + 1}
                    </span>

                    {w.correct ? (
                      <span className="font-semibold text-[#17544f]">
                        {w.submitted}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-baseline gap-3">
                        {/* user's wrong answer */}
                        <span className="text-[#b0472f] line-through">
                          {w.submitted || "(blank)"}
                        </span>
                        {/* arrow */}
                        <span className="text-[#9aa39f]">→</span>
                        {/* correct answer */}
                        <span className="font-semibold text-[#17544f]">
                          {w.expected}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#5c6a68]">{result.message}</p>
          )}

          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={handleNextQuestion}
              className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
            >
              Next question →
            </button>
            <button
              type="button"
              onClick={() => { setSelected({}); setResult(null); setError(null); }}
              className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
            >
              Redo question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
