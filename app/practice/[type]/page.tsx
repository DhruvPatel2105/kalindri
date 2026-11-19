import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { OFFICIAL_QUESTION_COUNTS, QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";
import { formatWeight, SCORE_WEIGHT_DISCLOSURE, SKILL_LABELS, weightsForType } from "@/lib/scoring/derivedWeights";
import { loadWeights } from "@/lib/scoring/loadWeights";


/**
 * Where a question type lands: two separate ways to work through it.
 *   Test      — attempt a whole set and get a final score (/tests)
 *   Practice  — all of a set's questions on one page, reveal answers and
 *               retry individual questions (/learn)
 * Test and Practice results are kept separate: a Practice attempt never
 * counts toward test scores, accuracy or the test dashboards.
 */
export default async function QuestionTypeLandingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) notFound();
  const questionType = type as QuestionType;
  const label = QUESTION_TYPE_LABELS[questionType];
  const { rows: weightRows } = await loadWeights(user.orgId);
  const contribution = weightsForType(weightRows, questionType);

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]">
            ← Back
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">{label}</h1>
          <p className="mt-1 text-sm text-[#5c6a68]">How would you like to work on this question type?</p>
        </div>

        {contribution.length > 0 ? (
          <div className="rounded-lg border border-[#ddd9d0] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">Score contribution</p>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
              {contribution.map((c) => (
                <li key={c.skill} className="text-sm text-[#1e2a2a]">
                  <span className="font-semibold">{formatWeight(c.weightPct)}</span> of {SKILL_LABELS[c.skill]}
                </li>
              ))}
              <li className="text-sm text-[#5c6a68]">
                {OFFICIAL_QUESTION_COUNTS[questionType]} questions per test
              </li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-[#7d8a88]">{SCORE_WEIGHT_DISCLOSURE}</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/practice/${type}/tests`}
            className="group flex flex-col gap-2 rounded-lg border border-[#ddd9d0] bg-white p-5 hover:border-[#1f6f6b]"
          >
            <ClipboardIcon />
            <span className="text-lg font-semibold text-[#1e2a2a] group-hover:text-[#1f6f6b]">Test</span>
            <span className="text-sm text-[#5c6a68]">Attempt questions and get your final score.</span>
          </Link>

          <Link
            href={`/practice/${type}/learn`}
            className="group flex flex-col gap-2 rounded-lg border border-[#bcd6d3] bg-white p-5 hover:border-[#1f6f6b]"
          >
            <BookIcon />
            <span className="text-lg font-semibold text-[#1e2a2a] group-hover:text-[#1f6f6b]">Practice</span>
            <span className="text-sm text-[#5c6a68]">Learn, reveal answers and retry individual questions.</span>
          </Link>
        </div>

        <p className="text-xs text-[#7d8a88]">
          Test results and Practice are tracked separately — answers you reveal in Practice never change your
          test scores.
        </p>
      </main>
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f6f6b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1f6f6b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5C5 4.5 8 4.5 12 6c4-1.5 7-1.5 9-.5V19c-2-1-5-1-9 .5-4-1.5-7-1.5-9-.5V5.5Z" />
      <path d="M12 6v13.5" />
    </svg>
  );
}
