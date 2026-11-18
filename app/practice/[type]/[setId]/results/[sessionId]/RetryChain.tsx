import Link from "next/link";

import type { RetryChainEntry } from "@/lib/practice/testEngine";
import { allCorrect, barSegments, type BarSegment } from "@/lib/practice/retry";

const BAR_TONE: Record<BarSegment["kind"], string> = {
  correct: "bg-[#4a9e5c]",
  partial: "bg-[#b58b2a]",
  incorrect: "bg-[#c8453a]",
  unanswered: "bg-[#c9c6bd]",
};
const BADGE_TONE: Record<BarSegment["kind"], string> = {
  correct: "bg-[#eaf2f1] text-[#17544f]",
  partial: "bg-[#fbf3e3] text-[#8a6a1e]",
  incorrect: "bg-[#fdf2f0] text-[#b0472f]",
  unanswered: "bg-[#eceae4] text-[#5c6a68]",
};
const BADGE_WORD: Record<BarSegment["kind"], string> = {
  correct: "correct",
  partial: "partly correct",
  incorrect: "incorrect",
  unanswered: "unanswered",
};

/**
 * The original test and each retry of it, round by round: how many questions
 * the round had and how it went, as a bar (green correct, amber partly
 * correct, red incorrect, grey unanswered). Ends with "All questions answered
 * correctly!" once a round has nothing left to practise.
 */
export function RetryChain({
  entries,
  currentSessionId,
  type,
  setId,
}: {
  entries: RetryChainEntry[];
  currentSessionId: string;
  type: string;
  setId: string;
}) {
  const last = entries[entries.length - 1];

  return (
    <section
      aria-label="Original test and retries"
      className="flex flex-col rounded-lg border border-[#ddd9d0] bg-white"
    >
      <h2 className="border-b border-[#f0ede5] px-4 py-3 text-sm font-semibold text-[#1e2a2a]">
        Your progress on this set
      </h2>

      <ol>
        {entries.map((entry) => {
          const isCurrent = entry.sessionId === currentSessionId;
          const segments = entry.summary ? barSegments(entry.summary) : [];
          const resultsHref = `/practice/${type}/${setId}/results/${entry.sessionId}`;
          return (
            <li
              key={entry.sessionId}
              className="flex flex-col gap-2 border-b border-[#f0ede5] px-4 py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {entry.status === "completed" && !isCurrent ? (
                  <Link href={resultsHref} className="text-base font-semibold text-[#1f6f6b] hover:underline">
                    {entry.label}
                  </Link>
                ) : (
                  <span className="text-base font-semibold text-[#1e2a2a]">{entry.label}</span>
                )}
                {isCurrent ? (
                  <span className="rounded bg-[#eceae4] px-2 py-0.5 text-xs text-[#5c6a68]">You&apos;re viewing this</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-[#5c6a68]">
                <span>
                  {entry.questionCount} {entry.questionCount === 1 ? "question" : "questions"}
                </span>
                {entry.summary ? (
                  segments.map((segment) => (
                    <span
                      key={segment.kind}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[segment.kind]}`}
                    >
                      {segment.count} {BADGE_WORD[segment.kind]}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="rounded-full bg-[#fbf3e3] px-2.5 py-0.5 text-xs font-medium text-[#8a6a1e]">
                      In progress
                    </span>
                    <Link
                      href={`/practice/${type}/${setId}/session/${entry.sessionId}`}
                      className="text-xs font-semibold text-[#1f6f6b] hover:underline"
                    >
                      Continue →
                    </Link>
                  </>
                )}
              </div>

              {entry.summary && segments.length > 0 ? (
                <div
                  role="img"
                  aria-label={segments.map((s) => `${s.count} ${BADGE_WORD[s.kind]}`).join(", ")}
                  className="flex h-2.5 w-full gap-1"
                >
                  {segments.map((segment) => (
                    <div
                      key={segment.kind}
                      className={`h-full rounded-full ${BAR_TONE[segment.kind]}`}
                      style={{ width: `${segment.percent}%` }}
                    />
                  ))}
                </div>
              ) : null}

              {entry === last && entry.summary && allCorrect(entry.summary) ? (
                <p className="text-sm font-semibold text-[#17544f]">All questions answered correctly!</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
