import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { startSession } from "@/lib/practice/startSession";
import type { McmReadingPayload } from "@/lib/questions/schemas/mcm-reading";
import type { McsReadingPayload } from "@/lib/questions/schemas/mcs-reading";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { PracticeQuestion } from "./PracticeQuestion";
import { PracticeQuestionMultiSelect } from "./PracticeQuestionMultiSelect";

/**
 * Proves the practice-session engine works end to end. Minimal styling,
 * functional proof only: no timer, no watermark, no drill/mock chrome, no
 * results-screen trait bars, no practice-selection screen. Not an
 * admin-only route — any authenticated user may practice.
 *
 * Always starts a FRESH session on every load (simplest approach, per the
 * task): resuming an in-progress session on reload is future work, so
 * lib/practice/getSession.ts isn't wired in here yet.
 *
 * Only MCS_READING and MCM_READING have seeded questions and UI so far; any
 * other valid QuestionType surfaces startSession's own clear "no published
 * question available" error rather than a fabricated message.
 */
export default async function PracticeTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    notFound();
  }

  const { sessionId, question } = await startSession(type as QuestionType);

  // Only the safe subset of each payload is ever handed to a client
  // component: never `correct_option_id`/`correct_option_ids` before
  // submission — the full Server Component payload IS visible to the
  // browser, so omitting it here (not just in the UI) is what actually
  // protects it. See PracticeQuestion.tsx / PracticeQuestionMultiSelect.tsx.
  let questionUi: React.ReactNode;
  if (question.type === "MCS_READING") {
    const payload = question.payload as McsReadingPayload;
    questionUi = (
      <PracticeQuestion
        sessionId={sessionId}
        passage={payload.passage}
        questionText={payload.question}
        options={payload.options}
      />
    );
  } else if (question.type === "MCM_READING") {
    const payload = question.payload as McmReadingPayload;
    questionUi = (
      <PracticeQuestionMultiSelect
        sessionId={sessionId}
        passage={payload.passage}
        questionText={payload.question}
        options={payload.options}
      />
    );
  } else {
    questionUi = (
      <p className="text-sm text-[#5c6a68]">
        No practice UI is built for {question.type} yet.
      </p>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-[#f4f2ee] px-4 py-10">
      <h1 className="text-xl font-semibold text-[#1e2a2a]">
        Practice — {question.type}
      </h1>
      {questionUi}
    </main>
  );
}
