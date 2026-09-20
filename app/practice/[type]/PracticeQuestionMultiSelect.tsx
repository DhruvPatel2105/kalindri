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
 * MCM_READING — checkboxes, since multiple selections are valid. Structurally
 * mirrors PracticeQuestion.tsx (useTransition, local error state, Next
 * Question button) rather than a new pattern; the real difference is the
 * response shape (string[] instead of string) and the negative-marking
 * result (lib/scoring/deterministic/negativeMarking.ts, unchanged — this
 * component only displays its existing output honestly).
 *
 * `correct_option_ids` is deliberately NOT among this component's props,
 * same reasoning as PracticeQuestion.tsx: the server only sends it back
 * after submission, inside `result.questionSnapshot`.
 */
export function PracticeQuestionMultiSelect({
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleOption(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((existing) => existing !== id)
        : [...prev, id],
    );
  }

  function handleSubmit() {
    if (selectedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const outcome = await submitAttempt(sessionId, selectedIds);
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  function handleNextQuestion() {
    setSelectedIds([]);
    setResult(null);
    setError(null);
    router.refresh();
  }

  const correctOptionIds: string[] =
    result?.questionSnapshot &&
    typeof result.questionSnapshot === "object" &&
    "correct_option_ids" in result.questionSnapshot &&
    Array.isArray(
      (result.questionSnapshot as { correct_option_ids: unknown })
        .correct_option_ids,
    )
      ? (result.questionSnapshot as { correct_option_ids: string[] })
          .correct_option_ids
      : [];

  // NegativeMarkingResult specifically — the only DeterministicScoreResult
  // shape with correctCount/incorrectCount. Checked narrowing, not a cast.
  const negativeMarkingResult =
    result?.scored && result.result && "correctCount" in result.result
      ? result.result
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-4 text-sm leading-relaxed text-[#1e2a2a]">
        {passage}
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-[#1e2a2a]">{questionText}</p>
        <p className="text-xs text-[#7d8a88]">
          Select all that apply. Incorrect selections subtract marks.
        </p>
      </div>

      <fieldset
        disabled={Boolean(result) || isPending}
        className="flex flex-col gap-2"
      >
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          const isCorrectOption = result && correctOptionIds.includes(option.id);
          const isWrongSelection =
            result && isSelected && !correctOptionIds.includes(option.id);
          const isMissedCorrect =
            result && !isSelected && correctOptionIds.includes(option.id);

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
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOption(option.id)}
              />
              {option.text}
              {isMissedCorrect ? (
                <span className="ml-auto text-xs text-[#7d8a88]">Missed</span>
              ) : null}
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
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            {selectedIds.length === 0
              ? "Nothing selected yet."
              : `${selectedIds.length} option${selectedIds.length === 1 ? "" : "s"} selected.`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || isPending}
            className="w-fit rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded border border-[#ddd9d0] bg-white p-4">
          {negativeMarkingResult ? (
            <>
              <p
                className={`text-lg font-semibold ${
                  negativeMarkingResult.score === negativeMarkingResult.maxScore
                    ? "text-[#1f6f6b]"
                    : "text-[#b0472f]"
                }`}
              >
                {negativeMarkingResult.score}/{negativeMarkingResult.maxScore}
              </p>
              <p className="text-sm text-[#5c6a68]">
                {negativeMarkingResult.correctCount} correct selection
                {negativeMarkingResult.correctCount === 1 ? "" : "s"} minus{" "}
                {negativeMarkingResult.incorrectCount} incorrect selection
                {negativeMarkingResult.incorrectCount === 1 ? "" : "s"}
                {negativeMarkingResult.correctCount -
                  negativeMarkingResult.incorrectCount <
                0
                  ? " — floored at 0, never a negative score."
                  : "."}
              </p>
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
