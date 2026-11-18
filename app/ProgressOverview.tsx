import Link from "next/link";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getHistoryPage } from "@/lib/practice/listHistory";
import { fillHistorySummaries, loadFinishedSessions } from "@/lib/practice/loadFinished";
import { loadMastery } from "@/lib/practice/loadMastery";
import { formatDuration } from "@/lib/practice/testState";
import { computeAllStats } from "@/lib/practice/typeStats";
import type { QuestionType } from "@/lib/questions/types";

import { HistoryList } from "./practice/HistoryList";
import { ScoreTrend } from "./practice/ScoreTrend";
import { TYPE_LABELS } from "./practice/[type]/typeLabels";

type SessionUser = Awaited<ReturnType<typeof requireActiveSession>>;

const RECENT = 5;
/** CLAUDE.md palette: bars under 60% are amber. */
const LOW_ACCURACY = 60;

const pct = (value: number | null) => (value !== null ? `${value}%` : "—");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * "Your progress" on the main dashboard: combined performance across every
 * question type. Same rules as the per-type dashboards (the two always
 * agree, because both come from computeTypeStats over the same saved
 * sessions): full-test accuracy counts completed FULL_PRACTICE sessions only,
 * retry accuracy completed INCORRECT_PRACTICE sessions only, and every
 * percentage is weighted — total correct ÷ total questions — never an average
 * of percentages. Question mastery is separate. Raw marks only, never a PTE
 * score or a CLB estimate.
 */
export async function ProgressOverview({ user }: { user: SessionUser }) {
  const finished = await loadFinishedSessions(user);
  const { overall, byType } = computeAllStats(finished);
  const mastery = await loadMastery(user.id);

  const history = await getHistoryPage(getDb(), {
    userId: user.id,
    requestedPage: 1,
  });
  const recent = await fillHistorySummaries(user, history.items.slice(0, RECENT));

  // Practised types first (in the dashboard's order), then the rest with a prompt.
  const types = Object.keys(TYPE_LABELS) as QuestionType[];
  const practised = types.filter((t) => byType.has(t));
  const notYet = types.filter(
    (t) => !byType.has(t) && t !== "MCS_READING" && t !== "MCM_READING",
  );

  const { improvement } = overall;
  const completedSessions = overall.full.sessions + overall.retry.sessions;

  return (
    <section aria-label="Your progress" className="mb-10 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#1e2a2a]">Your progress</h2>
        {history.total > 0 ? (
          <Link
            href="/practice/history"
            className="text-sm font-medium text-[#1f6f6b] hover:underline"
          >
            All practice history →
          </Link>
        ) : null}
      </div>

      {history.total === 0 ? (
        <div className="rounded border border-[#ddd9d0] bg-white px-6 py-5">
          <p className="text-sm text-[#5c6a68]">
            You haven&apos;t practised yet. Finish a test below and your overall performance, accuracy by
            question type and recent activity will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ── overall performance ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Full-test accuracy"
              value={pct(overall.full.accuracyPercent)}
              hint={`${overall.full.questions.correct} of ${plural(overall.full.questions.total, "question")} correct across all types; unanswered count as not correct`}
            />
            <Stat
              label="Retry accuracy"
              value={pct(overall.retry.accuracyPercent)}
              hint={
                overall.retry.questions.total > 0
                  ? `${overall.retry.questions.correct} of ${plural(overall.retry.questions.total, "question")} correct in retries`
                  : "no retries finished yet"
              }
            />
            <Stat
              label="Full-test improvement"
              value={
                improvement
                  ? `${improvement.points > 0 ? "+" : improvement.points < 0 ? "−" : ""}${Math.abs(improvement.points)} pts`
                  : "—"
              }
              tone={
                improvement
                  ? improvement.points > 0
                    ? "text-[#17544f]"
                    : improvement.points < 0
                      ? "text-[#8a6a1e]"
                      : undefined
                  : undefined
              }
              hint={
                improvement
                  ? `latest full test ${improvement.latestPercent}% vs previous ${improvement.previousPercent}%`
                  : "needs 2 completed full tests"
              }
            />
            <Stat
              label="Completed sessions"
              value={String(completedSessions)}
              hint={`${plural(overall.full.sessions, "full test")} · ${plural(overall.retry.sessions, "retry session")}`}
            />
            <Stat
              label="Practice time"
              value={overall.practiceSeconds > 0 ? formatDuration(overall.practiceSeconds * 1000) : "—"}
              hint="full tests and retries; approximate, each session capped at 2 hours"
            />
            <Stat
              label="Questions practised"
              value={String(overall.questionsPractised)}
              hint={
                mastery.overall.unique > 0
                  ? `${plural(mastery.overall.unique, "unique question")} · mastery ${pct(mastery.overall.percent)}`
                  : "attempted, full tests and retries"
              }
            />
          </div>

          {/* ── trend ── */}
          <div className="flex flex-col gap-3 rounded border border-[#ddd9d0] bg-white px-6 py-5">
            <h3 className="text-sm font-semibold text-[#1e2a2a]">Performance trend</h3>
            {improvement ? (
              <p className="text-sm text-[#5c6a68]">
                Your latest full test scored{" "}
                <strong className="text-[#1e2a2a]">{improvement.latestPercent}%</strong> accuracy, compared
                with {improvement.previousPercent}% on the one before (
                {improvement.points > 0 ? "+" : improvement.points < 0 ? "−" : ""}
                {Math.abs(improvement.points)} {Math.abs(improvement.points) === 1 ? "point" : "points"}).
                Different types and sets vary in difficulty
                {overall.full.sessions < 4 ? ", and with so few tests this is only a rough guide" : ""}.
              </p>
            ) : (
              <p className="text-sm text-[#5c6a68]">
                Finish at least 2 full tests to see whether your accuracy is improving.
              </p>
            )}
            {overall.trend.length > 0 ? (
              <ScoreTrend
                points={overall.trend}
                caption="Accuracy of each completed full test across all question types (retries left out)."
              />
            ) : null}
          </div>

          {/* ── performance by question type ── */}
          <div className="flex flex-col rounded border border-[#ddd9d0] bg-white">
            <h3 className="border-b border-[#f0ede5] px-6 py-3 text-sm font-semibold text-[#1e2a2a]">
              Performance by question type
            </h3>
            <ul>
              {practised.map((type) => {
                const stats = byType.get(type);
                if (!stats) return null;
                const accuracy = stats.full.accuracyPercent;
                const typeMastery = mastery.byType.get(type);
                return (
                  <li
                    key={type}
                    className="flex flex-col gap-2 border-b border-[#f0ede5] px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <div className="sm:w-56">
                      <p className="text-sm font-semibold text-[#1e2a2a]">{TYPE_LABELS[type]}</p>
                      <p className="mt-0.5 text-xs text-[#7d8a88]">
                        {plural(stats.full.sessions, "full test")} · {plural(stats.retry.sessions, "retry session")}
                        {typeMastery?.percent != null ? ` · mastery ${typeMastery.percent}%` : ""}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div
                          role="img"
                          aria-label={accuracy !== null ? `Full-test accuracy ${accuracy}%` : "No completed full tests yet"}
                          className="h-2.5 flex-1 rounded-full bg-[#eceae4]"
                        >
                          {accuracy !== null ? (
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(accuracy, 2)}%`,
                                background: accuracy < LOW_ACCURACY ? "#b58b2a" : "#1f6f6b",
                              }}
                            />
                          ) : null}
                        </div>
                        <span className="w-12 text-right text-sm font-semibold text-[#1e2a2a]">{pct(accuracy)}</span>
                      </div>
                      <p className="text-[11px] text-[#9aa39f]">
                        full-test accuracy
                        {stats.retry.accuracyPercent !== null
                          ? ` · retry accuracy ${stats.retry.accuracyPercent}%`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={`/practice/${type}/progress`}
                      className="w-fit rounded border border-[#dcd8cf] bg-white px-3 py-1.5 text-xs font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
                    >
                      {TYPE_LABELS[type]} dashboard →
                    </Link>
                  </li>
                );
              })}
              {notYet.map((type) => (
                <li
                  key={type}
                  className="flex items-center justify-between gap-4 border-b border-[#f0ede5] px-6 py-3 text-sm last:border-b-0"
                >
                  <span className="text-[#7d8a88]">{TYPE_LABELS[type]} — not practised yet</span>
                  <Link href={`/practice/${type}`} className="text-xs font-semibold text-[#1f6f6b] hover:underline">
                    Practise →
                  </Link>
                </li>
              ))}
            </ul>
            <p className="border-t border-[#f0ede5] px-6 py-3 text-xs text-[#9aa39f]">
              Accuracy is correct answers out of all questions, so unanswered questions count as not correct.
              Percentages are calculated from totals, not by averaging. Amber means under {LOW_ACCURACY}%.
              Mastery is the share of unique questions whose latest answer was correct.
            </p>
          </div>

          {/* ── recent activity ── */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#1e2a2a]">Recent activity</h3>
            <HistoryList items={recent} />
          </div>
        </>
      )}
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
    <div className="rounded border border-[#ddd9d0] bg-white px-4 py-3">
      <p className="text-xs text-[#7d8a88]">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[#9aa39f]">{hint}</p> : null}
    </div>
  );
}
