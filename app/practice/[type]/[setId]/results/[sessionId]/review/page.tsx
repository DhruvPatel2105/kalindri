import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { isUuid } from "@/lib/validation/uuid";
import {
  getReviewQuestion,
  getTestResults,
  TestSessionError,
} from "@/lib/practice/testEngine";
import { resultKind, type QuestionResultKind } from "@/lib/practice/testResults";
import { QUESTION_TYPES } from "@/lib/questions/types";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";

import { ReviewQuestion } from "../../../../../ReviewQuestion";

/**
 * Answer review, one question at a time: your answer beside the correct one,
 * green/red highlighting, unanswered questions flagged. Only reachable for a
 * submitted test — an unfinished one is sent back to the test, so a student
 * can't read the answers while still answering.
 *
 * `?q=` is the 1-based question number.
 */
const NAV_TONE: Record<QuestionResultKind | "unmarked", string> = {
  correct: "border-[#1f6f6b] bg-[#1f6f6b] text-white",
  partial: "border-[#b58b2a] bg-[#b58b2a] text-white",
  incorrect: "border-[#b0472f] bg-[#b0472f] text-white",
  unanswered: "border-[#ddd9d0] bg-[#eceae4] text-[#5c6a68]",
  unmarked: "border-[#ddd9d0] bg-white text-[#1e2a2a]",
};
const NAV_WORD: Record<QuestionResultKind | "unmarked", string> = {
  correct: "correct",
  partial: "partly correct",
  incorrect: "incorrect",
  unanswered: "not answered",
  unmarked: "not marked yet",
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; setId: string; sessionId: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { type, setId, sessionId } = await params;
  const { q } = await searchParams;

  const user = await requireActiveSession();

  if (
    !(QUESTION_TYPES as readonly string[]).includes(type) ||
    !isUuid(setId) ||
    !isUuid(sessionId)
  ) {
    notFound();
  }

  let results;
  try {
    results = await getTestResults(user, sessionId);
  } catch (err) {
    if (err instanceof TestSessionError) notFound();
    throw err;
  }
  if (results.status === "in_progress") redirect(`/practice/${type}/${setId}`);

  const total = results.questions.length;
  const raw = Array.isArray(q) ? q[0] : q;
  const requested = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : 1;
  const number = Math.min(Math.max(1, requested), Math.max(1, total));
  const index = number - 1;

  let data;
  try {
    data = await getReviewQuestion(user, sessionId, index);
  } catch (err) {
    if (err instanceof TestSessionError) notFound();
    throw err;
  }

  const base = `/practice/${type}/${setId}/results/${sessionId}`;
  const hrefFor = (n: number) => `${base}/review?q=${n}`;
  const label = QUESTION_TYPE_LABELS[results.type];

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="sticky top-0 z-10 border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href={base} className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]">
            ← Results
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="truncate text-sm font-semibold text-[#1e2a2a]">{results.setTitle}</span>
          <span className="hidden text-xs text-[#7d8a88] sm:inline">{label}</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="text-sm font-semibold uppercase tracking-wide text-[#5c6a68]">
            Review · Question {number} of {total}
          </h1>

          <ReviewQuestion review={data.review} />

          <div className="flex items-center justify-between gap-3 border-t border-[#e6e2d9] pt-5">
            {number > 1 ? (
              <Link
                href={hrefFor(number - 1)}
                className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {number < total ? (
              <Link
                href={hrefFor(number + 1)}
                className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
              >
                Next →
              </Link>
            ) : (
              <Link
                href={base}
                className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
              >
                Back to results
              </Link>
            )}
          </div>
        </main>

        <aside className="flex flex-col gap-4 rounded-lg border border-[#ddd9d0] bg-white p-4 lg:sticky lg:top-20 lg:w-64 lg:flex-none">
          <div>
            <h2 className="text-sm font-semibold text-[#1e2a2a]">Questions</h2>
            <p className="mt-0.5 text-xs text-[#5c6a68]">
              {results.summary.score}/{results.summary.maxScore} marks
            </p>
          </div>

          <nav aria-label="Review navigation" className="grid grid-cols-5 gap-1.5">
            {results.questions.map((question, i) => {
              const kind = resultKind(question) ?? "unmarked";
              return (
                <Link
                  key={question.id}
                  href={hrefFor(i + 1)}
                  aria-label={`Question ${i + 1}, ${NAV_WORD[kind]}`}
                  aria-current={i === index ? "step" : undefined}
                  className={`flex h-9 items-center justify-center rounded border text-sm font-medium ${NAV_TONE[kind]} ${
                    i === index ? "ring-2 ring-[#1e2a2a] ring-offset-1" : ""
                  }`}
                >
                  {i + 1}
                </Link>
              );
            })}
          </nav>

          <ul className="flex flex-col gap-1 text-xs text-[#5c6a68]">
            <Legend swatch="bg-[#1f6f6b]" text="Correct" />
            <Legend swatch="bg-[#b58b2a]" text="Partly correct" />
            <Legend swatch="bg-[#b0472f]" text="Incorrect" />
            <Legend swatch="bg-[#eceae4] border border-[#ddd9d0]" text="Not answered" />
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Legend({ swatch, text }: { swatch: string; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} /> {text}
    </li>
  );
}
