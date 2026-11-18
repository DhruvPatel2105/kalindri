"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { ClientQuestion } from "@/lib/practice/clientQuestion";
import { saveProgress, submitTest } from "@/lib/practice/testActions";
import { answerStatuses, clampIndex, countAnswered } from "@/lib/practice/testState";

import { BookmarkButton } from "../BookmarkButton";
import { DropdownBlanksInput } from "./inputs/DropdownBlanksInput";
import { McmInput } from "./inputs/McmInput";
import { McsInput } from "./inputs/McsInput";
import { ReorderInput } from "./inputs/ReorderInput";
import { WordBankInput } from "./inputs/WordBankInput";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Runs a whole question set as one test: question N of M, Previous / Next, a
 * numbered navigation panel showing which questions have an answer, and a
 * Submit Test button that works with questions left blank.
 *
 * Every change is autosaved to the server as it happens (saves are queued so
 * they land in order), so closing the tab loses nothing — the student resumes
 * where they were. Submitting waits for the queue to drain and re-sends any
 * answer that failed to save, so a flaky connection can't silently drop one.
 * No marks are shown until the test is submitted.
 */
export function TestRunner({
  sessionId,
  title,
  typeLabel,
  listHref,
  resultsHref,
  initialIndex,
  initialAnswers,
  questions,
}: {
  sessionId: string;
  title: string;
  typeLabel: string;
  /** The browse page — Back returns here (progress is already saved). */
  listHref: string;
  resultsHref: string;
  initialIndex: number;
  initialAnswers: Record<string, unknown>;
  questions: ClientQuestion[];
}) {
  const router = useRouter();
  const total = questions.length;

  const [index, setIndex] = useState(() => clampIndex(initialIndex, total));
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const answersRef = useRef(answers);
  const indexRef = useRef(index);
  // Saves run one after another so an older save can never land after a newer one.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(new Set<string>());

  const ids = questions.map((q) => q.id);
  const statuses = answerStatuses(ids, answers);
  const answeredCount = countAnswered(ids, answers);
  const unansweredCount = total - answeredCount;
  const current = questions[index];

  function enqueueSave(
    nextIndex: number,
    answer?: { questionId: string; response: unknown },
  ) {
    pending.current += 1;
    setSaveStatus("saving");
    chain.current = chain.current.then(async () => {
      let ok = false;
      try {
        const result = await saveProgress({
          sessionId,
          currentIndex: nextIndex,
          answer,
        });
        ok = result.ok;
      } catch {
        ok = false; // network error: surfaced below, retried at submit
      }
      if (answer) {
        if (ok) failed.current.delete(answer.questionId);
        else failed.current.add(answer.questionId);
      }
      pending.current -= 1;
      if (pending.current === 0) {
        setSaveStatus(failed.current.size > 0 ? "error" : "saved");
      }
    });
  }

  function handleAnswer(questionId: string, response: unknown) {
    const next = { ...answersRef.current, [questionId]: response };
    answersRef.current = next;
    setAnswers(next);
    enqueueSave(indexRef.current, { questionId, response });
  }

  function goTo(target: number) {
    const next = clampIndex(target, total);
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    enqueueSave(next);
  }

  // Warn before closing the tab while a save is still on its way.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (pending.current > 0 || failed.current.size > 0) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    await chain.current;

    // Re-send anything that didn't save. If it still can't, don't submit —
    // that answer would be lost.
    for (const questionId of [...failed.current]) {
      try {
        const result = await saveProgress({
          sessionId,
          currentIndex: indexRef.current,
          answer: { questionId, response: answersRef.current[questionId] },
        });
        if (result.ok) failed.current.delete(questionId);
      } catch {
        // still failing — handled below
      }
    }
    if (failed.current.size > 0) {
      setSaveStatus("error");
      setSubmitError(
        "Some answers couldn't be saved. Check your connection and try again — nothing has been submitted.",
      );
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitTest(sessionId);
      if (!result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitError("Couldn't reach the server. Try again — your answers are saved.");
      setSubmitting(false);
      return;
    }

    router.push(resultsHref);
  }

  function renderQuestion(q: ClientQuestion) {
    const common = { disabled: submitting };
    const value = answers[q.id];
    switch (q.kind) {
      case "MCS_READING":
        return (
          <McsInput
            key={q.id}
            {...common}
            passage={q.passage}
            questionText={q.questionText}
            options={q.options}
            value={asString(value)}
            onChange={(next) => handleAnswer(q.id, next)}
          />
        );
      case "MCM_READING":
        return (
          <McmInput
            key={q.id}
            {...common}
            passage={q.passage}
            questionText={q.questionText}
            options={q.options}
            value={asStrings(value)}
            onChange={(next) => handleAnswer(q.id, next)}
          />
        );
      case "REORDER_PARAGRAPH":
        return (
          <ReorderInput
            key={q.id}
            {...common}
            boxes={q.boxes}
            value={asStrings(value)}
            onChange={(next) => handleAnswer(q.id, next)}
          />
        );
      case "FIB_READING":
        return (
          <WordBankInput
            key={q.id}
            {...common}
            parts={q.parts}
            wordBank={q.wordBank}
            value={asStrings(value)}
            onChange={(next) => handleAnswer(q.id, next)}
          />
        );
      case "FIB_RW":
        return (
          <DropdownBlanksInput
            key={q.id}
            {...common}
            parts={q.parts}
            blanks={q.blanks}
            value={asStrings(value)}
            onChange={(next) => handleAnswer(q.id, next)}
          />
        );
      default:
        return (
          <p className="text-sm text-[#5c6a68]">
            No practice UI is built for this question type yet.
          </p>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      {/* ── top bar ── */}
      <header className="sticky top-0 z-10 border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={listHref}
              className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
            >
              ← Exit
            </Link>
            <span className="text-[#ddd9d0]">|</span>
            <span className="truncate text-sm font-semibold text-[#1e2a2a]">
              {title}
            </span>
            <span className="hidden text-xs text-[#7d8a88] sm:inline">
              {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span
              aria-live="polite"
              className={`text-xs ${saveStatus === "error" ? "font-semibold text-[#b0472f]" : "text-[#7d8a88]"}`}
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : saveStatus === "error"
                    ? "Couldn't save — will retry"
                    : ""}
            </span>
            <BookmarkButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start">
        {/* ── question ── */}
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-sm font-semibold uppercase tracking-wide text-[#5c6a68]">
              Question {index + 1} of {total}
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                statuses[index] === "answered"
                  ? "bg-[#e3f0ec] text-[#17544f]"
                  : "bg-[#eceae4] text-[#5c6a68]"
              }`}
            >
              {statuses[index] === "answered" ? "Answered" : "Not answered"}
            </span>
          </div>

          {current ? renderQuestion(current) : null}

          <div className="flex items-center justify-between gap-3 border-t border-[#e6e2d9] pt-5">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0 || submitting}
              className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1 || submitting}
              className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </main>

        {/* ── navigation panel ── */}
        <aside className="flex flex-col gap-4 rounded-lg border border-[#ddd9d0] bg-white p-4 lg:sticky lg:top-20 lg:w-64 lg:flex-none">
          <div>
            <h2 className="text-sm font-semibold text-[#1e2a2a]">Questions</h2>
            <p className="mt-0.5 text-xs text-[#5c6a68]">
              {answeredCount} of {total} answered
            </p>
          </div>

          <nav aria-label="Question navigation" className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const answered = statuses[i] === "answered";
              const isCurrent = i === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={submitting}
                  aria-label={`Question ${i + 1}, ${answered ? "answered" : "not answered"}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`h-9 rounded border text-sm font-medium ${
                    answered
                      ? "border-[#1f6f6b] bg-[#1f6f6b] text-white"
                      : "border-[#ddd9d0] bg-white text-[#1e2a2a] hover:border-[#1f6f6b]"
                  } ${isCurrent ? "ring-2 ring-[#b58b2a] ring-offset-1" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>

          <ul className="flex flex-col gap-1 text-xs text-[#5c6a68]">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#1f6f6b]" /> Answered
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border border-[#ddd9d0] bg-white" />{" "}
              Not answered
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm ring-2 ring-[#b58b2a]" /> Current
            </li>
          </ul>

          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setConfirming(true);
            }}
            disabled={submitting}
            className="rounded bg-[#1f6f6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            Submit Test
          </button>
        </aside>
      </div>

      {/* ── submit confirmation ── */}
      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
            <h2 id="submit-title" className="text-base font-semibold text-[#1e2a2a]">
              Submit this test?
            </h2>
            <p className="text-sm text-[#5c6a68]">
              You have answered {answeredCount} of {total} questions.
              {unansweredCount > 0
                ? ` ${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"} will score 0.`
                : ""}{" "}
              You can&apos;t change your answers after submitting.
            </p>
            {submitError ? (
              <p role="alert" className="text-sm text-[#b0472f]">
                {submitError}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="rounded border border-[#dcd8cf] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] disabled:opacity-60"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit test"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
