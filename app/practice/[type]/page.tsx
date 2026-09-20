import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { startSession } from "@/lib/practice/startSession";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { PracticeQuestion } from "./PracticeQuestion";

/**
 * Proves session 10A's engine works end to end, for MCS_READING — the
 * simplest deterministic type. Minimal styling, functional proof only: no
 * timer, no watermark, no drill/mock chrome, no results-screen trait bars.
 * Not an admin-only route — any authenticated user may practice.
 *
 * Always starts a FRESH session on every load (simplest approach, per the
 * task): resuming an in-progress session on reload is future work, so
 * lib/practice/getSession.ts isn't wired in here yet.
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

  // Only MCS_READING has seeded questions and UI support this session;
  // any other valid QuestionType surfaces startSession's own clear "no
  // published question available" error rather than a fabricated message.
  const { sessionId, question } = await startSession(type as QuestionType);

  const payload = question.payload as {
    passage: string;
    question: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-[#f4f2ee] px-4 py-10">
      <h1 className="text-xl font-semibold text-[#1e2a2a]">
        Practice — {question.type}
      </h1>

      {/*
        Only the safe subset of the payload is passed to the client: never
        `correct_option_id` before submission — the full Server Component
        payload IS visible to the browser, so omitting it here (not just in
        the UI) is what actually protects it. See PracticeQuestion.tsx.
      */}
      <PracticeQuestion
        sessionId={sessionId}
        passage={payload.passage}
        questionText={payload.question}
        options={payload.options}
      />
    </main>
  );
}
