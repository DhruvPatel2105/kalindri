import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { retryCount } from "@/lib/practice/retry";
import { getRetryChain, getTestResults, TestSessionError } from "@/lib/practice/testEngine";
import {
  questionsToReview,
  resultKind,
  type QuestionResultKind,
} from "@/lib/practice/testResults";
import { formatDuration } from "@/lib/practice/testState";
import { QUESTION_TYPES } from "@/lib/questions/types";

import { TYPE_LABELS } from "../../../typeLabels";
import { LocalTime } from "../../../../LocalTime";
import { RetryChain } from "./RetryChain";
import { StartRetryButton } from "./StartRetryButton";

/**
 * The session dashboard a student lands on straight after Submit Test: marks
 * and accuracy, a correct / partly correct / incorrect / unanswered
 * breakdown, time taken and when, a list of the questions to go back to
 * (each links into the answer review), and a way to review every answer.
 * It also offers "Practise incorrect questions" — a retry of just the
 * questions that weren't full marks — and shows the original test and each
 * retry round by round. Marks and answers only appear here, never during the
 * test.
 *
 * These are RAW MARKS for one set — not a PTE 10–90 score and not a CLB
 * estimate (CLAUDE.md scoring honesty rules), and the page says so.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_LABEL: Record<QuestionResultKind, string> = {
  correct: "Correct",
  partial: "Partly correct",
  incorrect: "Incorrect",
  unanswered: "Not answered",
};
const KIND_BADGE: Record<QuestionResultKind, string> = {
  correct: "bg-[#eaf2f1] text-[#17544f]",
  partial: "bg-[#fbf3e3] text-[#8a6a1e]",
  incorrect: "bg-[#fdf2f0] text-[#b0472f]",
  unanswered: "bg-[#eceae4] text-[#5c6a68]",
};
const STRIP_TONE: Record<QuestionResultKind | "unmarked", string> = {
  correct: "border-[#1f6f6b] bg-[#1f6f6b] text-white",
  partial: "border-[#b58b2a] bg-[#b58b2a] text-white",
  incorrect: "border-[#b0472f] bg-[#b0472f] text-white",
  unanswered: "border-[#ddd9d0] bg-[#eceae4] text-[#5c6a68]",
  unmarked: "border-[#ddd9d0] bg-white text-[#1e2a2a]",
};

export default async function TestResultsPage({
  params,
}: {
  params: Promise<{ type: string; setId: string; sessionId: string }>;
}) {
  const { type, setId, sessionId } = await params;

  const user = await requireActiveSession();

  if (
    !(QUESTION_TYPES as readonly string[]).includes(type) ||
    !UUID_RE.test(setId) ||
    !UUID_RE.test(sessionId)
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

  // Not submitted yet: back to the test, where their answers are waiting.
  if (results.status === "in_progress") {
    redirect(`/practice/${type}/${setId}`);
  }

  const { summary } = results;
  const label = TYPE_LABELS[results.type] ?? results.type;
  const base = `/practice/${type}/${setId}/results/${sessionId}`;
  const reviewHref = (n: number) => `${base}/review?q=${n}`;
  const toReview = questionsToReview(results.questions);
  const chain = await getRetryChain(user, sessionId);
  const current = chain.find((entry) => entry.sessionId === sessionId);
  // The newest round is the one that can be retried or continued.
  const latest = chain[chain.length - 1];
  const latestMistakes = latest?.summary ? retryCount(latest.summary) : 0;
  const elapsedMs = results.completedAt
    ? results.completedAt.getTime() - results.startedAt.getTime()
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href={`/practice/${type}/tests`}
            className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            ← All tests
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href={`/practice/${type}/progress`}
              className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
            >
              Your progress
            </Link>
            <Link
              href="/practice/history"
              className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
            >
              Test history
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">
            {current && current.depth > 0 ? `${current.label} — ` : ""}
            {results.setTitle}
          </h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            Test submitted
            {results.completedAt ? (
              <>
                {" · "}
                <LocalTime iso={results.completedAt.toISOString()} />
              </>
            ) : null}
          </p>
        </div>

        {/* ── score ── */}
        <section className="flex flex-col gap-3 rounded-lg border border-[#ddd9d0] bg-white p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-[#1e2a2a]">
              {summary.score}/{summary.maxScore}
            </span>
            <span className="text-sm text-[#5c6a68]">
              marks{summary.percent !== null ? ` · ${summary.percent}%` : ""}
            </span>
          </div>
          <p className="text-xs text-[#7d8a88]">
            Raw marks for this set only — not a PTE score or a CLB level, and
            not a prediction of either.
          </p>
          {summary.unscored > 0 ? (
            <p role="alert" className="text-sm text-[#b0472f]">
              {summary.unscored} answered{" "}
              {summary.unscored === 1 ? "question hasn't" : "questions haven't"} been
              marked yet. Your answers are saved — refresh this page to try again.
            </p>
          ) : null}
        </section>

        {/* ── breakdown ── */}
        <section
          aria-label="Results breakdown"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <Stat label="Total questions" value={String(summary.totalQuestions)} />
          <Stat label="Correct" value={String(summary.correct)} tone="text-[#17544f]" hint="full marks" />
          <Stat label="Partly correct" value={String(summary.partial)} tone="text-[#8a6a1e]" hint="some marks" />
          <Stat label="Incorrect" value={String(summary.incorrect)} tone="text-[#b0472f]" hint="no marks" />
          <Stat label="Unanswered" value={String(summary.unanswered)} hint="scored 0" />
          <Stat
            label="Completion rate"
            value={summary.completionPercent !== null ? `${summary.completionPercent}%` : "—"}
            hint="attempted out of all questions"
          />
          <Stat
            label="Accuracy"
            value={summary.accuracyPercent !== null ? `${summary.accuracyPercent}%` : "—"}
            hint="correct out of all questions; unanswered count as not correct"
          />
          <Stat
            label="Time taken"
            value={formatDuration(elapsedMs)}
            hint="start to submit, including time away"
          />
          <Stat
            label="Started"
            value={<LocalTime iso={results.startedAt.toISOString()} />}
          />
        </section>

        {/* ── practise incorrect questions ── */}
        {latest && latest.status === "in_progress" ? (
          <section className="flex flex-col gap-2 rounded-lg border border-[#ddd9d0] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#1e2a2a]">A retry is in progress</h2>
            <Link
              href={`/practice/${type}/${setId}/session/${latest.sessionId}`}
              className="w-fit rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
            >
              Continue retry
            </Link>
          </section>
        ) : latest && latestMistakes > 0 ? (
          <section className="flex flex-col gap-3 rounded-lg border border-[#ddd9d0] bg-white p-5">
            <div>
              <h2 className="text-sm font-semibold text-[#1e2a2a]">Practise what you missed</h2>
              <p className="mt-1 text-xs text-[#7d8a88]">
                {latest.sessionId === sessionId
                  ? "Repeat just"
                  : `Your latest round (${latest.label}) has ${latestMistakes} left. Repeat just`}{" "}
                the questions that weren&apos;t full marks — incorrect, partly correct and unanswered. You can
                keep going until you get them all right. Retries don&apos;t count toward your question
                statistics.
              </p>
            </div>
            <StartRetryButton
              parentSessionId={latest.sessionId}
              type={type}
              setId={setId}
              count={latestMistakes}
            />
          </section>
        ) : null}

        {chain.length > 1 ? (
          <RetryChain entries={chain} currentSessionId={sessionId} type={type} setId={setId} />
        ) : null}

        {/* ── questions to review ── */}
        <section className="overflow-hidden rounded-lg border border-[#ddd9d0] bg-white">
          <h2 className="border-b border-[#f0ede5] px-4 py-3 text-sm font-semibold text-[#1e2a2a]">
            Questions to review
            {toReview.length > 0 ? (
              <span className="ml-2 font-normal text-[#7d8a88]">({toReview.length})</span>
            ) : null}
          </h2>
          {toReview.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#5c6a68]">
              {summary.unscored > 0
                ? "Questions will appear here once your answers have been marked."
                : "Nothing to review — every question was fully correct."}
            </p>
          ) : (
            <ul>
              {toReview.map(({ index, kind }) => {
                const q = results.questions[index];
                if (!q) return null;
                return (
                  <li key={q.id} className="border-b border-[#f0ede5] last:border-b-0">
                    <Link
                      href={reviewHref(index + 1)}
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#fafaf8]"
                    >
                      <span className="font-medium text-[#1e2a2a]">Question {index + 1}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${KIND_BADGE[kind]}`}>
                        {KIND_LABEL[kind]}
                      </span>
                      <span className="ml-auto text-[#1e2a2a]">
                        {(q.score ?? 0)}/{q.maxScore ?? "?"}
                      </span>
                      <span className="text-xs font-semibold text-[#1f6f6b]">See answer →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── jump to any question ── */}
        <section className="flex flex-col gap-3 rounded-lg border border-[#ddd9d0] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1e2a2a]">All questions</h2>
          <nav aria-label="Jump to a question's review" className="flex flex-wrap gap-1.5">
            {results.questions.map((q, i) => {
              const kind = resultKind(q);
              return (
                <Link
                  key={q.id}
                  href={reviewHref(i + 1)}
                  aria-label={`Question ${i + 1}, ${kind ? KIND_LABEL[kind].toLowerCase() : "not marked yet"}`}
                  className={`flex h-9 w-9 items-center justify-center rounded border text-sm font-medium ${STRIP_TONE[kind ?? "unmarked"]}`}
                >
                  {i + 1}
                </Link>
              );
            })}
          </nav>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5c6a68]">
            <Legend swatch="bg-[#1f6f6b]" text="Correct" />
            <Legend swatch="bg-[#b58b2a]" text="Partly correct" />
            <Legend swatch="bg-[#b0472f]" text="Incorrect" />
            <Legend swatch="bg-[#eceae4] border border-[#ddd9d0]" text="Not answered" />
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={reviewHref(1)}
            className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
          >
            Review all answers
          </Link>
          <Link
            href={`/practice/${type}/${setId}`}
            className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
          >
            Retake this set
          </Link>
          <Link
            href={`/practice/${type}/tests`}
            className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
          >
            Choose another set
          </Link>
        </div>

        <p className="text-xs text-[#7d8a88]">
          Kalindri is an unofficial practice platform and is not affiliated
          with or endorsed by Pearson.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "text-[#1e2a2a]",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-[#ddd9d0] bg-white px-3 py-2.5">
      <p className="text-xs text-[#7d8a88]">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[#9aa39f]">{hint}</p> : null}
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
