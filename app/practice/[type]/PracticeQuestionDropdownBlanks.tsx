"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

/**
 * FIB_RW — click a blank, a list of choices appears, pick one. Reuses
 * design/components/DropdownBlank.dc.html's interaction exactly: it's a
 * native `<select>` per blank (its own "click reveals a list" is just the
 * browser's own dropdown behaviour), not the drag-from-a-shared-pool
 * interaction PracticeQuestionWordBank.tsx (FIB_READING) uses — the two
 * types have genuinely different UIs despite sharing a scorer.
 *
 * `blanks` prop carries ONLY each blank's `options` — never
 * `correct_option`, which is the answer key and only ever revealed
 * post-submission. `parts` is the passage split on its `{{n}}` markers,
 * safe pre-submission (the markers carry no answer content).
 *
 * Per-blank correctness in the result comes straight from
 * `result.result.words` (WordBySpellingResult) — not re-derived from
 * questionSnapshot a second way, same reasoning as
 * PracticeQuestionWordBank.tsx: the scorer's own output already carries
 * expected/submitted/correct per blank, so reimplementing that comparison
 * here would just be a second place for it to silently drift from the real
 * scoring result.
 */
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

  // WordBySpellingResult specifically — the only DeterministicScoreResult
  // variant with a `words` array. Checked narrowing, not a cast.
  const wordResults =
    result?.scored && result.result && "words" in result.result
      ? result.result.words
      : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        Below is a text with blanks. Click on each blank, a list of choices
        will appear. Select the appropriate answer choice for each blank.
      </p>

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
                    onChange={(event) => handleSelect(i, event.target.value)}
                    className={`mx-1.5 inline-block rounded border px-2 py-1 align-middle text-sm ${
                      result
                        ? wordResult?.correct
                          ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                          : "border-[#b0472f] bg-white text-[#b0472f]"
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
                          you chose &ldquo;{wordResult.submitted}&rdquo;
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
