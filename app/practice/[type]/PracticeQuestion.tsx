"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

interface Option {
  id: string;
  text: string;
}

/**
 * MCS_READING only, for now — session 10B's minimal proof of the engine.
 * `correct_option_id` is deliberately NOT among this component's props: the
 * server only sends it back after submission, inside `result.questionSnapshot`
 * (see lib/practice/submitAttempt.ts) — never in the initial render, which
 * would leak the answer key to the browser before the student answers.
 */
export function PracticeQuestion({
  sessionId,
  passage,
  questionText,
  options,
}: {
  sessionId: string;
  passage: string;
  questionText: string;
  options: Option[];
}) {
  const router = useRouter();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!selectedOptionId) return;
    setError(null);
    startTransition(async () => {
      try {
        const outcome = await submitAttempt(sessionId, selectedOptionId);
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  /**
   * No new engine logic: this resets local state and asks the parent
   * Server Component (app/practice/[type]/page.tsx) to re-render, which
   * re-runs its existing "always start a fresh session on load" path —
   * exactly what a manual browser refresh already does today.
   */
  function handleNextQuestion() {
    setSelectedOptionId(null);
    setResult(null);
    setError(null);
    router.refresh();
  }

  const correctOptionId =
    result?.questionSnapshot &&
    typeof result.questionSnapshot === "object" &&
    "correct_option_id" in result.questionSnapshot
      ? String(
          (result.questionSnapshot as { correct_option_id: unknown })
            .correct_option_id,
        )
      : null;

  const isCorrect =
    result?.scored && result.result
      ? result.result.score === result.result.maxScore
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-4 text-sm leading-relaxed text-[#1e2a2a]">
        {passage}
      </div>

      <p className="font-medium text-[#1e2a2a]">{questionText}</p>

      <fieldset
        disabled={Boolean(result) || isPending}
        className="flex flex-col gap-2"
      >
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrectOption = result && option.id === correctOptionId;
          const isWrongSelection =
            result && isSelected && option.id !== correctOptionId;

          return (
            <label
              key={option.id}
              className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
                isCorrectOption
                  ? "border-[#1f6f6b] bg-[#fafaf8]"
                  : isWrongSelection
                    ? "border-[#b0472f] bg-white"
                    : "border-[#ddd9d0] bg-white"
              }`}
            >
              <input
                type="radio"
                name="option"
                value={option.id}
                checked={isSelected}
                onChange={() => setSelectedOptionId(option.id)}
              />
              {option.text}
            </label>
          );
        })}
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedOptionId || isPending}
          className="w-fit rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
        >
          {isPending ? "Submitting…" : "Submit"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded border border-[#ddd9d0] bg-white p-4">
          {result.scored && result.result ? (
            <>
              <p
                className={`text-lg font-semibold ${isCorrect ? "text-[#1f6f6b]" : "text-[#b0472f]"}`}
              >
                {isCorrect ? "Correct" : "Incorrect"} — {result.result.score}/
                {result.result.maxScore}
              </p>
              <p className="text-sm text-[#5c6a68]">
                You selected:{" "}
                {options.find((o) => o.id === selectedOptionId)?.text ??
                  selectedOptionId}
              </p>
              {correctOptionId ? (
                <p className="text-sm text-[#5c6a68]">
                  Correct answer:{" "}
                  {options.find((o) => o.id === correctOptionId)?.text ??
                    correctOptionId}
                </p>
              ) : null}
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
