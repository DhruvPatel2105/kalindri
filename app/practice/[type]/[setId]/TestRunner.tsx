"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { ClientQuestion } from "@/lib/practice/clientQuestion";
import { formatClock } from "@/lib/practice/clock";
import { saveProgress, saveTimings, submitTest } from "@/lib/practice/testActions";
import { answerStatuses, clampIndex, countAnswered } from "@/lib/practice/testState";

import { BookmarkButton } from "../BookmarkButton";
import { QuestionInput } from "./inputs/QuestionInput";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Changes are saved this long after the last one, so a burst of edits
 * (several drops, a few dropdown picks, flicking through questions) is one
 * request rather than one per change. Submitting or leaving the page sends
 * anything still waiting at once.
 */
const SAVE_DELAY_MS = 600;

/**
 * Runs a whole question set as one test: question N of M, Previous / Next, a
 * numbered navigation panel showing which questions have an answer, and a
 * Submit Test button that works with questions left blank.
 *
 * Every change is autosaved (debounced per question, see SAVE_DELAY_MS, and
 * queued so saves land in order), so closing the tab loses nothing — the
 * student resumes where they were. Submitting waits for the queue to drain and re-sends any
 * answer that failed to save, so a flaky connection can't silently drop one.
 * No marks are shown until the test is submitted.
 *
 * It also keeps time: a clock in the top bar, and the active seconds spent on
 * each question (counted only while this tab is visible), saved with the
 * answers so the results can show where the time went.
 */
export function TestRunner({
  sessionId,
  title,
  typeLabel,
  listHref,
  resultsHref,
  initialIndex,
  initialAnswers,
  initialTimings = {},
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
  /** Seconds already spent per question (by id) — the clock carries on from here. */
  initialTimings?: Record<string, number>;
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

  const timingsRef = useRef<Record<string, number>>({ ...initialTimings });
  const timingsDirty = useRef(false);
  const submittingRef = useRef(false);
  const [elapsed, setElapsed] = useState(() => Object.values(initialTimings).reduce((sum, s) => sum + s, 0));

  const answersRef = useRef(answers);
  const indexRef = useRef(index);
  // Saves run one after another so an older save can never land after a newer one.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(new Set<string>());
  // Answers changed but not yet sent (the latest value per question).
  const dirty = useRef(new Map<string, unknown>());
  // The current question changed since the last save.
  const positionDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Queues the time spent so far (cumulative per question) behind any saves; best effort. */
  function sendTimings() {
    if (!timingsDirty.current) return;
    timingsDirty.current = false;
    const snapshot = { ...timingsRef.current };
    chain.current = chain.current.then(async () => {
      try {
        await saveTimings({ sessionId, timings: snapshot });
      } catch {
        timingsDirty.current = true; // try again with the next flush
      }
    });
  }

  /** Starts (or restarts) the countdown to sending whatever is waiting. */
  function scheduleFlush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushDirty, SAVE_DELAY_MS);
  }

  /**
   * Sends every answer still waiting (each carries the current position), or
   * just the position if only that changed. Returns whether anything was sent.
   */
  function flushDirty(): boolean {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    sendTimings();
    if (dirty.current.size === 0 && !positionDirty.current) return false;
    if (dirty.current.size > 0) {
      for (const [questionId, response] of dirty.current) {
        enqueueSave(indexRef.current, { questionId, response });
      }
    } else {
      enqueueSave(indexRef.current);
    }
    dirty.current.clear();
    positionDirty.current = false;
    return true;
  }

  function handleAnswer(questionId: string, response: unknown) {
    const next = { ...answersRef.current, [questionId]: response };
    answersRef.current = next;
    setAnswers(next);
    dirty.current.set(questionId, response);
    setSaveStatus("saving");
    scheduleFlush();
  }

  function goTo(target: number) {
    const next = clampIndex(target, total);
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    // The position is only needed to resume where the student left off, so
    // it rides along with the next save instead of costing a request per
    // click: flipping through ten questions is one save, not ten.
    positionDirty.current = true;
    scheduleFlush();
  }

  // The clock: once a second, while this tab is showing, the current question
  // gets another second. Saved with the next flush, and every 15 s regardless.
  useEffect(() => {
    let ticks = 0;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible" || submittingRef.current) return;
      const id = questions[indexRef.current]?.id;
      if (!id) return;
      timingsRef.current[id] = (timingsRef.current[id] ?? 0) + 1;
      timingsDirty.current = true;
      setElapsed((seconds) => seconds + 1);
      ticks += 1;
      if (ticks % 15 === 0) flushDirty();
    }, 1000);
    return () => clearInterval(interval);
    // Only refs and the stable question list are read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before closing the tab while a save is waiting or on its way, and
  // send anything waiting if the runner is left (e.g. via the navigation bar).
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirty.current.size > 0 || pending.current > 0 || failed.current.size > 0) {
        flushDirty();
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushDirty();
    };
    // flushDirty only touches refs, so binding it once is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    flushDirty();

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
            <span
              role="timer"
              aria-label="Time spent on this test"
              className="rounded bg-[#eaf2f1] px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-[#17544f]"
              title="Time spent on this test (only while this page is open)"
            >
              {formatClock(elapsed)}
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

          {current ? (
            <QuestionInput
              question={current}
              value={answers[current.id]}
              onChange={(next) => handleAnswer(current.id, next)}
              disabled={submitting}
            />
          ) : null}

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
