"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

/**
 * FIB_READING — drag words from a word bank into inline blanks, reusing
 * design/components/WordBankBlanks.dc.html's interaction pattern (text
 * segments with inline gaps above, a word-bank pool below; dropping a word
 * on a gap places it there, dropping on the bank — or clicking a filled gap
 * — returns it) rather than inventing a new one. Structurally still mirrors
 * the other PracticeQuestion* components (useTransition, local error
 * state, key={sessionId} remount, Next Question button).
 *
 * `parts` prop arrives from the Server Component page, split from
 * `passage_with_blanks` on its `{{n}}` markers — this is safe pre-submission
 * (the markers carry no answer content). `wordBank` is the full candidate
 * pool (correct answers + distractors), also safe to show upfront — that's
 * the exercise. Only `correct_answers` (which pool word belongs to which
 * blank) is ever protected, and it's never sent to the client before
 * submission at all: the per-blank correctness/answer-key data below comes
 * straight from `result.result.words` (WordBySpellingResult), which
 * `submitAttempt` only returns after scoring — not from a separate
 * `questionSnapshot` re-extraction, since the scorer's own output already
 * carries `expected`/`submitted`/`correct` per blank and re-deriving it a
 * second way would risk exactly the kind of scoring/display drift the
 * REORDER_PARAGRAPH cross-check test was written to catch.
 */
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

  /** Removes `word` from wherever it currently sits, then places it at `gapIndex` (or leaves it in the bank if `gapIndex` is null). */
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

  function handleDragEnd() {
    setDraggingWord(null);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
  }

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

  // WordBySpellingResult specifically — the only DeterministicScoreResult
  // variant with a `words` array. Checked narrowing, not a cast.
  const wordResults =
    result?.scored && result.result && "words" in result.result
      ? result.result.words
      : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        In the text below some words are missing. Drag words from the box
        below to the appropriate place in the text. To undo an answer
        choice, drag the word back to the box below the text — or click a
        filled blank to clear it.
      </p>

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
                          ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                          : "border-[#b0472f] bg-white text-[#b0472f]"
                        : filledWord
                          ? "cursor-pointer border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                          : "border-dashed border-[#a9c4c1] bg-white text-[#7d8a88]"
                    }`}
                  >
                    {filledWord || " ".repeat(8)}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

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
              draggable={!result}
              onDragStart={handleDragStart(word)}
              onDragEnd={handleDragEnd}
              className={`rounded border bg-white px-4 py-1.5 text-sm text-[#1e2a2a] shadow-sm ${
                draggingWord === word
                  ? "border-[#1f6f6b] opacity-50"
                  : "border-[#cfccc2]"
              } ${result ? "cursor-default" : "cursor-grab"}`}
            >
              {word}
            </span>
          ))}
          {bank.length === 0 ? (
            <span className="text-xs text-[#9aa39f]">All words placed.</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {!result ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            There are more words than gaps. One mark per correct placement,
            nothing deducted for a wrong one — fill every gap.
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-fit flex-none rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded border border-[#ddd9d0] bg-white p-4">
          {wordResults && result.result ? (
            <>
              <p
                className={`text-lg font-semibold ${
                  result.result.score === result.result.maxScore
                    ? "text-[#1f6f6b]"
                    : "text-[#b0472f]"
                }`}
              >
                {result.result.score}/{result.result.maxScore}
              </p>
              <div className="flex flex-col gap-2">
                {wordResults.map((wordResult, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                      wordResult.correct
                        ? "border-[#1f6f6b] bg-[#fafaf8]"
                        : "border-[#b0472f] bg-white"
                    }`}
                  >
                    <span
                      className={
                        wordResult.correct
                          ? "flex-none text-[#1f6f6b]"
                          : "flex-none text-[#b0472f]"
                      }
                    >
                      {wordResult.correct ? "✓" : "✗"}
                    </span>
                    <span className="text-[#1e2a2a]">
                      Blank {index + 1}:{" "}
                      {wordResult.submitted ? (
                        <>
                          you put &ldquo;{wordResult.submitted}&rdquo;
                        </>
                      ) : (
                        <>you left this blank</>
                      )}
                      {!wordResult.correct ? (
                        <>
                          {" "}
                          — correct answer: &ldquo;{wordResult.expected}
                          &rdquo;
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#5c6a68]">{result.message}</p>
          )}

          <button
            type="button"
            onClick={handleNextQuestion}
            className="w-fit rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f]"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
