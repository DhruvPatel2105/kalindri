import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { startSession } from "@/lib/practice/startSession";
import type { McmReadingPayload } from "@/lib/questions/schemas/mcm-reading";
import type { McsReadingPayload } from "@/lib/questions/schemas/mcs-reading";
import type { ReorderParagraphPayload } from "@/lib/questions/schemas/reorder-paragraph";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { PracticeQuestion } from "./PracticeQuestion";
import { PracticeQuestionMultiSelect } from "./PracticeQuestionMultiSelect";
import { PracticeQuestionReorder } from "./PracticeQuestionReorder";

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
 * Only MCS_READING, MCM_READING and REORDER_PARAGRAPH have seeded questions
 * and UI so far; any other valid QuestionType surfaces startSession's own
 * clear "no published question available" error rather than a fabricated
 * message.
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
  // component: never `correct_option_id`/`correct_option_ids`/the boxes'
  // real order before submission — the full Server Component payload IS
  // visible to the browser, so omitting/shuffling it here (not just in the
  // UI) is what actually protects it. See PracticeQuestion.tsx /
  // PracticeQuestionMultiSelect.tsx / PracticeQuestionReorder.tsx.
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
  } else if (question.type === "REORDER_PARAGRAPH") {
    const payload = question.payload as ReorderParagraphPayload;
    // Shuffled here, server-side, so the student never sees the correct
    // order up front — the whole point of the exercise. `key={sessionId}`
    // forces a fresh component instance per session: this component keeps
    // its own drag-state copy of the boxes, so without a remount it would
    // keep showing the PREVIOUS question's boxes after "Next question".
    questionUi = (
      <PracticeQuestionReorder
        key={sessionId}
        sessionId={sessionId}
        boxes={shuffle(payload.boxes).map((text, index) => ({
          key: `box-${index}`,
          text,
        }))}
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

/** Not cryptographic — just display-order shuffling, so Math.random is fine. */
function shuffle<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.item);
}
