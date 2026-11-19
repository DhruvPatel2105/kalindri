import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getMockResults } from "@/lib/practice/mockEngine";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { isUuid } from "@/lib/validation/uuid";

import { Stat } from "../../../../_components/Stat";

/**
 * Results of a finished Reading mock: overall raw marks, then each question
 * type on its own. These are raw marks from each type's own scoring rule —
 * not a PTE 10–90 score or CLB level (CLAUDE.md scoring honesty rules).
 */
export default async function ReadingMockResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireActiveSession();
  if (!isUuid(sessionId)) notFound();

  const view = await getMockResults(user, sessionId);
  if (!view) notFound();
  const { results } = view;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-[#f4f2ee] px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#17544f]">Reading Mock Test — Results</h1>
        <p className="mt-1 text-sm text-[#5c6a68]">Submitted</p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-[#ddd9d0] bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-4xl font-semibold text-[#17544f]">
            {results.score} / {results.maxScore}
          </span>
          <span className="text-sm text-[#5c6a68]">
            marks{results.percent !== null ? ` · ${results.percent}%` : ""} · {results.totalQuestions} questions
          </span>
        </div>
        <p className="text-xs text-[#7d8a88]">
          Raw marks for this mock only — not a PTE score or a CLB level, and not a prediction of either.
        </p>
        {results.unmarked > 0 ? (
          <p role="alert" className="text-sm text-[#b0472f]">
            {results.unmarked} {results.unmarked === 1 ? "answer is" : "answers are"} saved but not marked yet.
            Reload this page to try again — you don&apos;t need to re-answer.
          </p>
        ) : null}
      </section>

      <section aria-label="Overall breakdown" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Correct" value={String(results.correct)} tone="text-[#17544f]" />
        <Stat label="Incorrect" value={String(results.incorrect)} tone="text-[#b0472f]" />
        {results.partial > 0 ? <Stat label="Partly correct" value={String(results.partial)} tone="text-[#8a6a1e]" /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5c6a68]">By question type</h2>
        <div className="overflow-x-auto rounded-lg border border-[#ddd9d0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#ddd9d0] bg-[#fafaf8] text-[#5c6a68]">
              <tr>
                <th className="px-4 py-2 font-medium">Question type</th>
                <th className="px-4 py-2 font-medium">Questions</th>
                <th className="px-4 py-2 font-medium">Correct</th>
                <th className="px-4 py-2 font-medium">Marks</th>
                <th className="px-4 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {results.perType.map((row) => (
                <tr key={row.type} className="border-b border-[#ddd9d0] last:border-0">
                  <td className="px-4 py-2 text-[#1e2a2a]">{QUESTION_TYPE_LABELS[row.type]}</td>
                  <td className="px-4 py-2 text-[#5c6a68]">{row.questions}</td>
                  <td className="px-4 py-2 text-[#5c6a68]">
                    {row.correct}
                    {row.partial > 0 ? ` (+${row.partial} partly)` : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">
                    {row.score} / {row.maxScore}
                  </td>
                  <td className="min-w-32 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded bg-[#eceae4]">
                        <div
                          className="h-full"
                          style={{
                            width: `${row.percent ?? 0}%`,
                            background: (row.percent ?? 0) < 60 ? "#b58b2a" : "#1f6f6b",
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#5c6a68]">{row.percent !== null ? `${row.percent}%` : "—"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#7d8a88]">
          Each type is marked by its own rule: blanks one mark each, multiple answers +1 correct / −1 incorrect
          (not below 0), reorder by correct adjacent pairs, single choice one mark.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/mock/reading"
          className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
        >
          Take another mock
        </Link>
        <Link
          href="/"
          className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
        >
          Back to home
        </Link>
      </div>

      <p className="text-xs text-[#7d8a88]">
        Kalindri is an unofficial practice platform and is not affiliated with or endorsed by Pearson.
      </p>
    </main>
  );
}
