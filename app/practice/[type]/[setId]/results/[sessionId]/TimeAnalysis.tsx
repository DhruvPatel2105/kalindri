import Link from "next/link";

import { analyzeTiming, formatSeconds } from "@/lib/practice/pace";
import type { TestResults } from "@/lib/practice/testEngine";
import { resultKind, type QuestionResultKind } from "@/lib/practice/testResults";

import { Stat } from "../../../../../_components/Stat";

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

/**
 * Where the time went: total and average time, how each question compared
 * with the suggested pace for its type, and a few observations that are
 * specific to this test. Shows nothing for a test taken before timing was
 * recorded. The suggested pace is a practice guide, not an official limit.
 */
export function TimeAnalysis({ results, reviewHref }: { results: TestResults; reviewHref: (n: number) => string }) {
  const analysis = analyzeTiming(
    results.type,
    results.questions.map((q) => ({ index: q.index, seconds: q.timeSeconds, kind: resultKind(q) })),
  );
  if (!analysis) return null;

  const { pace } = analysis;
  const scaleMax = Math.max(analysis.slowest?.seconds ?? 0, (pace?.limit ?? 0) * 1.25, 1);
  const markerLeft = pace ? Math.min(100, (pace.limit / scaleMax) * 100) : null;

  return (
    <section aria-label="Time analysis" className="flex flex-col gap-4 rounded-lg border border-[#ddd9d0] bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-[#1e2a2a]">Time analysis</h2>
        <p className="mt-1 text-xs text-[#7d8a88]">
          Time is counted while this page is open on screen, from the first question to submit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Time spent" value={formatSeconds(analysis.totalSeconds)} />
        <Stat label="Average per question" value={formatSeconds(analysis.averageSeconds)} />
        <Stat label="Suggested pace" value={pace ? pace.label : "—"} hint={pace ? "per question" : "this type is timed by the test"} />
        <Stat
          label="Within pace"
          value={pace ? `${analysis.withinPace} of ${analysis.timedQuestions}` : "—"}
          tone={pace && analysis.overPace > 0 ? "text-[#8a6a1e]" : "text-[#17544f]"}
        />
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-[#1e2a2a]">
        {analysis.insights.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="text-[#1f6f6b]">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#ddd9d0] text-xs text-[#5c6a68]">
            <tr>
              <th className="py-2 pr-3 font-medium">Question</th>
              <th className="py-2 pr-3 font-medium">Result</th>
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="w-full min-w-40 py-2 font-medium">{pace ? `Against suggested pace (${pace.label})` : "Time"}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((row) => (
              <tr key={row.index} className="border-b border-[#f0ede5] last:border-0">
                <td className="py-2 pr-3">
                  <Link href={reviewHref(row.index + 1)} className="font-medium text-[#1f6f6b] hover:underline">
                    {row.index + 1}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  {row.kind ? (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${KIND_BADGE[row.kind]}`}>{KIND_LABEL[row.kind]}</span>
                  ) : (
                    <span className="text-xs text-[#7d8a88]">Not marked</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-[#1e2a2a]">{formatSeconds(row.seconds)}</td>
                <td className="py-2">
                  <div className="relative h-2.5 w-full overflow-hidden rounded bg-[#eceae4]">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, (row.seconds / scaleMax) * 100)}%`,
                        background: row.status === "over" ? "#b58b2a" : "#1f6f6b",
                      }}
                    />
                    {markerLeft !== null ? (
                      <div className="absolute inset-y-0 w-0.5 bg-[#1e2a2a]" style={{ left: `${markerLeft}%` }} aria-hidden="true" />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#7d8a88]">
        The suggested pace is a practice guide for how long to aim to spend on one question of this type — not an
        official limit.
      </p>
    </section>
  );
}
