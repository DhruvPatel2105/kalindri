"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { LearnQuestion } from "@/lib/practice/learnEngine";
import { setBookmarkAction } from "@/lib/practice/bookmarkActions";
import type { BookmarkColor } from "@/lib/practice/bookmarkColors";
import { answerQuestionAction } from "@/lib/practice/learnActions";
import { buildQuestionReview } from "@/lib/practice/reviewModel";
import type { QuestionReview } from "@/lib/practice/reviewModel";
import type { QuestionResultKind } from "@/lib/practice/testResults";


import { DifficultyTag } from "../../../../_components/DifficultyTag";
import { ReviewQuestion } from "../../../ReviewQuestion";
import { BookmarkButton } from "../../BookmarkButton";
import { QuestionListDrawer } from "./QuestionListDrawer";
import { QuestionInput } from "../../[setId]/inputs/QuestionInput";

const STATUS: Record<QuestionResultKind | "none", { label: string; tone: string }> = {
  none: { label: "Not attempted", tone: "bg-[#eceae4] text-[#5c6a68]" },
  correct: { label: "Correct", tone: "bg-[#eaf2f1] text-[#17544f]" },
  partial: { label: "Partly correct", tone: "bg-[#fbf3e3] text-[#8a6a1e]" },
  incorrect: { label: "Incorrect", tone: "bg-[#fdf2f0] text-[#b0472f]" },
  unanswered: { label: "Not attempted", tone: "bg-[#eceae4] text-[#5c6a68]" },
};


/**
 * Practice: ONE question per page. Next loads the next question, Previous goes
 * back. Press Answer at any time — with or without having tried the question —
 * to see the correct answer next to yours (green / red); Try Again clears the
 * answer and allows another attempt (the earlier attempt stays saved). Nothing
 * about the correct answer is in the page until Answer is pressed. Answers and
 * results are kept as you move between questions.
 */
export function PracticeRunner({
  type,
  setId,
  title,
  typeLabel,
  listHref,
  questions,
}: {
  type: string;
  setId: string;
  title: string;
  typeLabel: string;
  listHref: string;
  questions: LearnQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [reviews, setReviews] = useState<Record<string, QuestionReview | undefined>>({});
  const [lastKinds, setLastKinds] = useState<Record<string, QuestionResultKind | null>>(
    () => Object.fromEntries(questions.map((q) => [q.id, q.lastKind])),
  );
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(questions.map((q) => [q.id, q.attempts])),
  );
  const [bookmarks, setBookmarks] = useState<Record<string, BookmarkColor | null>>(
    () => Object.fromEntries(questions.map((q) => [q.id, q.bookmark])),
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const attempted = questions.filter((q) => lastKinds[q.id] != null).length;
  const correct = questions.filter((q) => lastKinds[q.id] === "correct").length;

  /**
   * Shows the answer at once from the prefetched answer key — no request to
   * wait for — then records the attempt on the server in the background. If
   * saving fails the answer stays on screen and a small note says the attempt
   * wasn't saved.
   */
  function handleAnswer(q: LearnQuestion) {
    const response = responses[q.id];
    const review = buildQuestionReview(q.answerKey, response);
    setReviews((prev) => ({ ...prev, [q.id]: review }));
    setLastKinds((prev) => ({ ...prev, [q.id]: review.kind }));
    if (review.answered) {
      setAttemptCounts((prev) => ({ ...prev, [q.id]: (prev[q.id] ?? 0) + 1 }));
    }
    setErrors((prev) => ({ ...prev, [q.id]: undefined }));

    void answerQuestionAction({ type, setId, questionId: q.id, response })
      .then((result) => {
        if (!result.ok) throw new Error(result.error);
        // The server's own marking and count are the record; they match the
        // instant result, but take them as final.
        setLastKinds((prev) => ({ ...prev, [q.id]: result.kind }));
        setAttemptCounts((prev) => ({ ...prev, [q.id]: result.attemptNumber }));
      })
      .catch(() => {
        setErrors((prev) => ({
          ...prev,
          [q.id]: "Your answer is shown, but this attempt couldn't be saved to your history.",
        }));
      });
  }

  /** Clears the answer and the revealed result so the question can be attempted again. */
  function handleTryAgain(id: string) {
    setResponses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setReviews((prev) => ({ ...prev, [id]: undefined }));
    setErrors((prev) => ({ ...prev, [id]: undefined }));
  }

  /** Saves a bookmark colour; shows it immediately and puts it back if saving fails. */
  async function handleBookmark(q: LearnQuestion, color: BookmarkColor | null) {
    const before = bookmarks[q.id] ?? null;
    setBookmarks((prev) => ({ ...prev, [q.id]: color }));
    setErrors((prev) => ({ ...prev, [q.id]: undefined }));
    try {
      const result = await setBookmarkAction({ questionId: q.id, color });
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      setBookmarks((prev) => ({ ...prev, [q.id]: before }));
      setErrors((prev) => ({
        ...prev,
        [q.id]: err instanceof Error ? err.message : "Couldn't save the bookmark.",
      }));
    }
  }

  // Stable across renders so the (memoised) question drawer doesn't re-render
  // every time an answer changes.
  const go = useCallback(
    (target: number) => {
      const next = Math.min(Math.max(0, target), questions.length - 1);
      setIndex(next);
      // A new question starts at the top of the page.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [questions.length],
  );


  // What the drawer lists; rebuilt only when a result or bookmark changes,
  // not on every keystroke or selection in an answer.
  const drawerQuestions = useMemo(
    () =>
      questions.map((q) => ({
        number: q.number,
        header: q.header,
        difficulty: q.difficulty,
        kind: reviews[q.id]?.kind ?? lastKinds[q.id] ?? null,
        bookmark: bookmarks[q.id] ?? null,
      })),
    [questions, reviews, lastKinds, bookmarks],
  );

  const current = questions[index];
  const review = current ? reviews[current.id] : undefined;
  const status = STATUS[review?.kind ?? (current ? lastKinds[current.id] : null) ?? "none"];
  const attemptsSoFar = current ? (attemptCounts[current.id] ?? 0) : 0;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="sticky top-0 z-10 border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/practice/${type}`} className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]">
              ← Back
            </Link>
            <span className="text-[#ddd9d0]">|</span>
            <span className="truncate text-sm font-semibold text-[#1e2a2a]">{title}</span>
            <span className="hidden text-xs text-[#7d8a88] sm:inline">{typeLabel} · Practice</span>
          </div>
          <div className="flex flex-none items-center gap-4">
            <span className="text-xs text-[#5c6a68]" aria-live="polite">
              {attempted} of {questions.length} attempted · {correct} correct
            </span>
            <Link href={listHref} className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]">
              Change set
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <p className="text-xs text-[#7d8a88]">
          Press Answer whenever you like to see the correct answer — try the question first for feedback on your
          own answer. Try Again lets you have another go. Practice is tracked separately from your tests.
        </p>
        {current ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-sm font-semibold uppercase tracking-wide text-[#5c6a68]">
                Question {current.number} of {questions.length}
              </span>
              <DifficultyTag difficulty={current.difficulty} />
              <span className={`rounded px-2 py-0.5 font-medium ${status.tone}`}>{status.label}</span>
              {attemptsSoFar > 0 ? (
                <span className="text-[#7d8a88]">
                  {attemptsSoFar} {attemptsSoFar === 1 ? "attempt" : "attempts"}
                </span>
              ) : null}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-base font-semibold text-[#1e2a2a]">{current.header}</h1>
              <BookmarkButton
                value={bookmarks[current.id] ?? null}
                onChange={(color) => void handleBookmark(current, color)}
              />
            </div>

            <div className="rounded-lg border border-[#ddd9d0] bg-white px-4 py-5">
              {review ? (
                <ReviewQuestion review={review} mode="practice" />
              ) : (
                <QuestionInput
                  question={current.client}
                  value={responses[current.id]}
                  onChange={(next) => setResponses((prev) => ({ ...prev, [current.id]: next }))}
                />
              )}
            </div>

            {errors[current.id] ? (
              <p role="alert" className="text-sm text-[#b0472f]">
                {errors[current.id]}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {review ? (
                <button
                  type="button"
                  onClick={() => handleTryAgain(current.id)}
                  className="rounded border border-[#1f6f6b] bg-white px-5 py-2.5 text-sm font-semibold text-[#1f6f6b] hover:bg-[#f4faf9]"
                >
                  Try Again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAnswer(current)}
                  className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Answer
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#e6e2d9] pt-5">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
                >
                  ← Previous
                </button>
              ) : (
                <span />
              )}
              {index < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
                >
                  Next Question →
                </button>
              ) : (
                <Link
                  href={listHref}
                  className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
                >
                  Finish — change set
                </Link>
              )}
            </div>
          </>
        ) : null}
      </main>

      <QuestionListDrawer
        currentIndex={index}
        onSelect={go}
        questions={drawerQuestions}
      />
    </div>
  );
}
