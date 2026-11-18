import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { startSession } from "@/lib/practice/startSession";
import type { FibReadingPayload } from "@/lib/questions/schemas/fib-reading";
import type { FibRwPayload } from "@/lib/questions/schemas/fib-rw";
import type { McmReadingPayload } from "@/lib/questions/schemas/mcm-reading";
import type { McsReadingPayload } from "@/lib/questions/schemas/mcs-reading";
import type { ReorderParagraphPayload } from "@/lib/questions/schemas/reorder-paragraph";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { BookmarkButton } from "./BookmarkButton";
import { PracticeQuestion } from "./PracticeQuestion";
import { PracticeQuestionDropdownBlanks } from "./PracticeQuestionDropdownBlanks";
import { PracticeQuestionMultiSelect } from "./PracticeQuestionMultiSelect";
import { PracticeQuestionReorder } from "./PracticeQuestionReorder";
import { PracticeQuestionWordBank } from "./PracticeQuestionWordBank";

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
 * Only MCS_READING, MCM_READING, REORDER_PARAGRAPH, FIB_READING and
 * FIB_RW have seeded questions and UI so far; any other valid QuestionType
 * surfaces startSession's own clear "no published question available"
 * error rather than a fabricated message.
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
  } else if (question.type === "FIB_READING") {
    const payload = question.payload as FibReadingPayload;
    // Splitting on {{n}} markers is safe pre-submission — the markers carry
    // no answer content, only where the gaps are. `word_bank`'s display
    // order is shuffled for the same reason REORDER_PARAGRAPH's boxes are:
    // if it weren't, and the seed content happened to list correct answers
    // in blank order (a real risk when authoring this content by hand), the
    // bank's order alone could give the answer away.
    questionUi = (
      <PracticeQuestionWordBank
        key={sessionId}
        sessionId={sessionId}
        parts={payload.passage_with_blanks.split(/\{\{\d+\}\}/)}
        wordBank={shuffle(payload.word_bank)}
      />
    );
  } else if (question.type === "FIB_RW") {
    const payload = question.payload as FibRwPayload;
    // Never `correct_option` — only `options` — crosses this boundary
    // before submission; that's the protected answer key.
    questionUi = (
      <PracticeQuestionDropdownBlanks
        key={sessionId}
        sessionId={sessionId}
        parts={payload.passage_with_blanks.split(/\{\{\d+\}\}/)}
        blanks={payload.blanks.map((blank) => ({ options: blank.options }))}
      />
    );
  } else {
    questionUi = (
      <p className="text-sm text-[#5c6a68]">
        No practice UI is built for {question.type} yet.
      </p>
    );
  }

  const typeLabels: Partial<Record<QuestionType, string>> = {
    REORDER_PARAGRAPH: "Reorder Paragraph",
    FIB_RW: "R&W Fill in the Blanks",
    FIB_READING: "Reading Fill in the Blanks",
    MCS_READING: "Multiple Choice (Single)",
    MCM_READING: "Multiple Choice (Multiple)",
  };
  const label = typeLabels[question.type] ?? question.type;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      {/* ── top bar ── */}
      <header className="sticky top-0 z-10 border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
            >
              ← Back
            </Link>
            <span className="text-[#ddd9d0]">|</span>
            <span className="text-sm font-semibold text-[#1e2a2a]">
              {label}
            </span>
          </div>
          <BookmarkButton />
        </div>
      </header>

      {/* ── question body ── */}
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        {questionUi}
      </main>
    </div>
  );
}

/** Not cryptographic — just display-order shuffling, so Math.random is fine. */
function shuffle<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.item);
}
