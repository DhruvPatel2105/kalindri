import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getBankSummary } from "@/lib/practice/bank";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { StartTestControl } from "./StartTestControl";

/**
 * Start page for one question type, used for both ways of working:
 *   - "test"     (/practice/[type]/tests): choose how many questions, sit them
 *     as a test and get a final score. Questions rotate: you don't see one
 *     again until you've answered every question in the bank.
 *   - "practice" (/practice/[type]/learn): choose how many questions and work
 *     through them on one page, revealing answers and retrying one at a time.
 * Both work from the TOTAL number of questions of the type — there is no
 * question-set list to choose from.
 *
 * CLAUDE.md content protection: this page shows counts only — no passage
 * text, options or answer keys.
 */

export type BrowseMode = "test" | "practice";

export async function SetBrowser({ type, mode }: { type: string; mode: BrowseMode }) {
  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    notFound();
  }
  const questionType = type as QuestionType;
  const label = QUESTION_TYPE_LABELS[questionType];

  const bank = await getBankSummary(getDb(), { userId: user.id, orgId: user.orgId, type: questionType });

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href={`/practice/${type}`}
            className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            ← Back
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
          {mode === "test" ? (
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
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">
            {label} — {mode === "test" ? "Test" : "Practice"}
          </h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            {bank
              ? `${bank.poolSize} ${bank.poolSize === 1 ? "question" : "questions"} available — ${
                  mode === "test"
                    ? "choose how many you want, then start a test and get your final score."
                    : "choose how many you want to practise, one question at a time."
                }`
              : "No questions are available yet."}
          </p>
        </div>

        {bank ? (
          <div className="flex flex-col gap-3 rounded-lg border border-[#bcd6d3] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1e2a2a]">
                {mode === "test" ? "Start a test" : "Start practice"}
              </p>
              <p className="mt-1 text-xs text-[#5c6a68]">
                {mode === "test" ? (
                  <>
                    Questions come from all {bank.poolSize}. You won&apos;t see a question again until
                    you&apos;ve answered every one.{" "}
                    {bank.remaining === bank.poolSize
                      ? "Nothing answered yet this round."
                      : `${bank.remaining} of ${bank.poolSize} left this round.`}
                    {bank.roundsCompleted > 0
                      ? ` You've completed all the questions ${bank.roundsCompleted} ${bank.roundsCompleted === 1 ? "time" : "times"}.`
                      : ""}
                  </>
                ) : (
                  <>
                    Questions are picked at random from all {bank.poolSize}. Practice is tracked separately from
                    your tests.
                  </>
                )}
              </p>
            </div>
            {mode === "test" && bank.inProgress ? (
              <Link
                href={`/practice/${type}/${bank.setId}`}
                className="shrink-0 rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f]"
              >
                Continue
              </Link>
            ) : (
              <StartTestControl
                type={type}
                setId={bank.setId}
                total={bank.poolSize}
                mode={mode}
                defaultCount={mode === "test" ? (bank.remaining > 0 ? bank.remaining : bank.poolSize) : Math.min(bank.poolSize, 10)}
              />
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
