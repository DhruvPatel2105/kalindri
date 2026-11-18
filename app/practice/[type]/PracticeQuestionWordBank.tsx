"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

export function PracticeQuestionWordBank({
  sessionId,
  parts,
  wordBank,
}: {
  sessionId: string;
  parts: string[];
  wordBank: string[];
}) {
  const router = useRouter();
  const blankCount = Math.max(0, parts.length - 1);

  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [draggingWord, setDraggingWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const usedWords = new Set(Object.values(placed));
  const bank = wordBank.filter((word) => !usedWords.has(word));

  function place(word: string, gapIndex: number | null) {
    setPlaced((prev) => {
      const next: Record<number, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (value !== word) next[Number(key)] = value;
      }
      if (gapIndex !== null) next[gapIndex] = word;
      return next;
    });
  }

  function handleDragStart(word: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("text/plain", word);
      setDraggingWord(word);
    };
  }
  function handleDragEnd() { setDraggingWord(null); }
  function handleDragOver(event: React.DragEvent) { event.preventDefault(); }

  function handleDropOnGap(gapIndex: number) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      const word = event.dataTransfer.getData("text/plain");
      if (word) place(word, gapIndex);
    };
  }
  function handleDropOnBank(event: React.DragEvent) {
    event.preventDefault();
    const word = event.dataTransfer.getData("text/plain");
    if (word) place(word, null);
  }
  function handleClearGap(gapIndex: number) {
    const current = placed[gapIndex];
    if (current) place(current, null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const response = Array.from(
          { length: blankCount },
          (_, i) => placed[i] ?? "",
        );
        const outcome = await submitAttempt(sessionId, response);
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  function handleNextQuestion() {
    setPlaced({});
    setResult(null);
    setError(null);
    router.refresh();
  }

  const wordResults =
    result?.scored && result.result && "words" in result.result
      ? result.result.words
      : null;

  const score = result?.result?.score ?? 0;
  const maxScore = result?.result?.maxScore ?? blankCount;
  const allCorrect = score === maxScore;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        In the text below some words are missing. Drag words from the box
        below to the appropriate place in the text. To undo, drag the word
        back to the box — or click a filled blank to clear it.
      </p>

      {/* ── passage with inline gaps ── */}
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-7 py-6">
        <p className="text-base leading-loose text-[#283634]">
          {parts.map((text, i) => {
            const isGap = i < blankCount;
            const filledWord = placed[i];
            const wordResult = wordResults?.[i];

            return (
              <span key={i}>
                {text}
                {isGap ? (
                  <span
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnGap(i)}
                    onClick={() => !result && handleClearGap(i)}
                    className={`mx-1.5 inline-block min-w-[110px] rounded border px-3 py-0.5 text-center align-middle ${
                      result
                        ? wordResult?.correct
                          ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#17544f]"
                          : "border-[#b0472f] bg-[#fdf2f0] text-[#b0472f]"
                        : filledWord
                          ? "cursor-pointer border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                          : "border-dashed border-[#a9c4c1] bg-white text-[#7d8a88]"
                    }`}
                  >
                    {filledWord || "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

      {/* ── word bank (hidden after submit) ── */}
      {!result ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
            Word bank
          </span>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnBank}
            className="flex min-h-[64px] flex-wrap gap-2.5 rounded border border-dashed border-[#bfd6d3] bg-[#f2f7f6] p-4"
          >
            {bank.map((word) => (
              <span
                key={word}
                draggable
                onDragStart={handleDragStart(word)}
                onDragEnd={handleDragEnd}
                className={`rounded border bg-white px-4 py-1.5 text-sm text-[#1e2a2a] shadow-sm ${
                  draggingWord === word
                    ? "border-[#1f6f6b] opacity-50"
                    : "border-[#cfccc2]"
                } cursor-grab`}
              >
                {word}
              </span>
            ))}
            {bank.length === 0 ? (
              <span className="text-xs text-[#9aa39f]">All words placed.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {/* ── pre-submit footer ── */}
      {!result ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            There are more words than gaps. One mark per correct placement,
            nothing deducted for wrong ones.
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
                  {/* tick / cross badge */}
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
                        {/* wrong answer struck through */}
                        <span className="text-[#b0472f] line-through">
                          {w.submitted || "(blank)"}
                        </span>
                        <span className="text-[#9aa39f]">→</span>
                        {/* correct answer in green */}
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
              onClick={() => { setPlaced({}); setResult(null); setError(null); }}
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
