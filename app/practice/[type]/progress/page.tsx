import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getHistoryPage } from "@/lib/practice/listHistory";
import { fillHistorySummaries, loadFinishedSessions } from "@/lib/practice/loadFinished";
import { parsePageParam } from "@/lib/practice/questionList";
import { formatDuration } from "@/lib/practice/testState";
import { loadMastery } from "@/lib/practice/loadMastery";
import { computeTypeStats, MAX_SESSION_MS } from "@/lib/practice/typeStats";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { HistoryList } from "../../HistoryList";
import { Pagination } from "../../Pagination";
import { TYPE_LABELS } from "../typeLabels";
import { ScoreTrend } from "../../ScoreTrend";

/**
 * One question type's progress dashboard. Full tests and retries are kept
 * apart: full-test accuracy, completion rate and improvement come from
 * completed FULL_PRACTICE sessions only, retry accuracy from completed
 * INCORRECT_PRACTICE sessions only. All percentages are weighted (total
 * correct ÷ total questions), never an average of percentages. Question
 * mastery is separate again: the share of unique questions whose latest
 * completed answer was correct. Everything is read back from saved sessions,
 * so it's here after a refresh or a new login. All figures are raw marks —
 * never a PTE score or a CLB estimate.
 */
export default async function TypeProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { type } = await params;
  const { page: pageParam } = await searchParams;

  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) notFound();
  const questionType = type as QuestionType;
  const label = TYPE_LABELS[questionType] ?? questionType;

  const finished = await loadFinishedSessions(user, questionType);
  const stats = computeTypeStats(finished);
  const mastery = (await loadMastery(user.id)).byType.get(questionType) ?? null;

  const history = await getHistoryPage(getDb(), {
    userId: user.id,
    requestedPage: parsePageParam(pageParam),
    type: questionType,
  });
  const historyItems = await fillHistorySummaries(user, history.items);
  const pageHref = (n: number) =>
    n === 1 ? `/practice/${type}/progress` : `/practice/${type}/progress?page=${n}`;

  const { improvement } = stats;
  const pct = (value: number | null) => (value !== null ? `${value}%` : "—");
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href={`/practice/${type}/tests`}
            className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            ← Tests
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
          <Link
            href="/practice/history"
            className="ml-auto text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            All test history
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">{label} — your progress</h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            Everything you&apos;ve practised in this question type, saved to your account.
          </p>
        </div>

        {history.total === 0 ? (
          <section className="flex flex-col gap-3 rounded-lg border border-[#ddd9d0] bg-white p-5">
            <p className="text-sm text-[#5c6a68]">
              You haven&apos;t practised this question type yet. Finish a test and your progress will appear here.
            </p>
            <Link
              href={`/practice/${type}/tests`}
              className="w-fit rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
            >
              Choose a set
            </Link>
          </section>
        ) : (
          <>
            {/* ── full tests ── */}
            <Group title="Full tests" note="Completed full tests only — retries are counted separately below.">
              <Stat
                label="Completed full tests"
                value={String(stats.full.sessions)}
                hint="total sessions"
              />
              <Stat
                label="Full-test accuracy"
                value={pct(stats.full.accuracyPercent)}
                hint={`${stats.full.questions.correct} of ${plural(stats.full.questions.total, "question")} correct; unanswered count as not correct`}
              />
              <Stat
                label="Completion rate"
                value={pct(stats.full.completionPercent)}
                hint={`${stats.full.questions.attempted} of ${stats.full.questions.total} questions attempted`}
              />
              <Stat
                label="Correct answers"
                value={String(stats.full.questions.correct)}
                tone="text-[#17544f]"
                hint="full marks"
              />
              <Stat
                label="Incorrect answers"
                value={String(stats.full.questions.incorrect)}
                tone="text-[#b0472f]"
                hint={`${stats.full.questions.partial} partly correct · ${stats.full.questions.unanswered} unanswered`}
              />
              <Stat
                label="Average score"
                value={pct(stats.full.marksPercent)}
                hint={
                  stats.full.marks.maxScore > 0
                    ? `${stats.full.marks.score}/${stats.full.marks.maxScore} marks overall`
                    : undefined
                }
              />
            </Group>

            {/* ── retries ── */}
            <Group title="Retries" note="Practise-incorrect-questions sessions, kept out of the full-test figures.">
              <Stat label="Completed retry sessions" value={String(stats.retry.sessions)} hint="total sessions" />
              <Stat
                label="Retry accuracy"
                value={pct(stats.retry.accuracyPercent)}
                hint={
                  stats.retry.questions.total > 0
                    ? `${stats.retry.questions.correct} of ${plural(stats.retry.questions.total, "question")} correct`
                    : "no retries finished yet"
                }
              />
            </Group>

            {/* ── learning progress ── */}
            <section className="flex flex-col gap-4 rounded-lg border border-[#ddd9d0] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#1e2a2a]">Learning progress</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#7d8a88]">Full-test improvement</p>
                  {improvement ? (
                    <>
                      <p
                        className={`mt-0.5 text-2xl font-bold ${
                          improvement.points > 0
                            ? "text-[#17544f]"
                            : improvement.points < 0
                              ? "text-[#8a6a1e]"
                              : "text-[#1e2a2a]"
                        }`}
                      >
                        {improvement.points > 0 ? "+" : improvement.points < 0 ? "−" : ""}
                        {Math.abs(improvement.points)} {Math.abs(improvement.points) === 1 ? "point" : "points"}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-[#7d8a88]">
                        Your latest full test scored {improvement.latestPercent}% accuracy, compared with{" "}
                        {improvement.previousPercent}% on the one before.
                        {stats.full.sessions < 4 ? " Only a few tests so far, so treat it as a rough guide." : ""}{" "}
                        Different sets vary in difficulty.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-[#5c6a68]">
                      Finish at least 2 full tests of this type to compare your latest with the one before.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-[#7d8a88]">Question mastery</p>
                  <p className="mt-0.5 text-2xl font-bold text-[#1e2a2a]">{pct(mastery?.percent ?? null)}</p>
                  <p className="mt-1 text-xs leading-snug text-[#7d8a88]">
                    {mastery && mastery.unique > 0
                      ? `${mastery.mastered} of ${plural(mastery.unique, "unique question")} answered correctly the last time you answered them, including in retries.`
                      : "Answer some questions to see how many you've mastered."}
                  </p>
                </div>
              </div>

              {stats.trend.length > 0 ? <ScoreTrend points={stats.trend} /> : null}
            </section>

            {/* ── practice time ── */}
            <section aria-label="Practice time" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Total practice time"
                value={stats.practiceSeconds > 0 ? formatDuration(stats.practiceSeconds * 1000) : "—"}
                hint={`full tests and retries; each session capped at ${MAX_SESSION_MS / 3_600_000} hours so time away doesn't inflate it`}
              />
              <Stat
                label="Average per session"
                value={
                  stats.averageSessionSeconds !== null
                    ? formatDuration(stats.averageSessionSeconds * 1000)
                    : "—"
                }
              />
              <Stat
                label="Questions practised"
                value={String(stats.questionsPractised)}
                hint="attempted, full tests and retries"
              />
            </section>

            {/* ── saved sessions ── */}
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[#1e2a2a]">
                Practice sessions
                <span className="ml-2 font-normal text-[#7d8a88]">({history.total})</span>
              </h2>
              <HistoryList items={historyItems} />
              <Pagination
                page={history.pagination.page}
                totalPages={history.pagination.totalPages}
                hrefFor={pageHref}
              />
            </section>
          </>
        )}

        <p className="text-xs text-[#7d8a88]">
          Scores are raw marks for each set — not a PTE score or a CLB level, and not a prediction of
          either. Accuracy is correct answers ÷ all questions, so unanswered questions count as not
          correct; completion rate is attempted questions ÷ all questions. Percentages are calculated
          from totals across sessions, not by averaging each session&apos;s percentage. Only completed
          sessions are counted.
        </p>
      </main>
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold text-[#1e2a2a]">{title}</h2>
        <p className="text-xs text-[#7d8a88]">{note}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "text-[#1e2a2a]",
}: {
  label: string;
  value: string;
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
