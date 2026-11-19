import Link from "next/link";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import {
  formatClock,
  MOCK_SEQUENCE,
  MOCK_TIME_LIMIT_S,
  missingMockTypes,
  secondsRemaining,
} from "@/lib/practice/mock";
import { countMockBanks, findOpenMock } from "@/lib/practice/mockEngine";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";

/**
 * The Reading Mock Test start page: what the exam contains, the clock, and a
 * Start (or Continue) button. Shows counts only — no question content.
 */
export default async function ReadingMockStartPage() {
  const user = await requireActiveSession();
  const [open, banks] = await Promise.all([findOpenMock(user), countMockBanks(user)]);
  const missing = missingMockTypes(banks);
  const left = open ? secondsRemaining(open.deadline, new Date()) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-[#f4f2ee] px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#17544f]">Reading Mock Test</h1>
        <p className="mt-1 text-sm text-[#5c6a68]">
          A full Reading section in the order of the real test, against one clock. Questions are drawn from all
          five Reading question banks.
        </p>
      </div>

      <section className="rounded-lg border border-[#ddd9d0] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5c6a68]">The sequence</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {MOCK_SEQUENCE.map(({ type, min, max }, i) => (
            <li key={type} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-[#1e2a2a]">
                <span className="mr-2 text-[#7d8a88]">{i + 1}.</span>
                {QUESTION_TYPE_LABELS[type]}
              </span>
              <span className="text-xs text-[#7d8a88]">
                {min === max ? min : `${min}–${max}`} questions · {banks[type]} in the bank
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-[#1e2a2a]">
          Time allowed: <span className="font-semibold">{formatClock(MOCK_TIME_LIMIT_S)} minutes</span> for the
          whole section. You can move between questions and change answers until you submit or time runs out;
          the clock keeps running if you leave the page, and anything answered is submitted when it ends.
        </p>
      </section>

      {missing.length > 0 ? (
        <p role="alert" className="rounded border border-[#e2c9c2] bg-[#fdf2f0] px-4 py-3 text-sm text-[#b0472f]">
          The mock needs at least one question of every Reading type. Not available yet:{" "}
          {missing.map((type) => QUESTION_TYPE_LABELS[type]).join(", ")}.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/mock/reading/run"
            className="rounded bg-[#1f6f6b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#17544f]"
          >
            {open ? "Continue mock test" : "Start mock test"}
          </Link>
          {open ? (
            <span className="text-sm text-[#5c6a68]">
              {left > 0 ? `${formatClock(left)} left on the clock` : "Time is up — it will be submitted when you continue."}
            </span>
          ) : null}
        </div>
      )}

      <p className="text-xs text-[#7d8a88]">
        Results are raw marks per question type — not a PTE score or a CLB level, and not a prediction of
        either. Kalindri is an unofficial practice platform and is not affiliated with Pearson.
      </p>
    </main>
  );
}
