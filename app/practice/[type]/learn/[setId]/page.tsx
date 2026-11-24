import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { isUuid } from "@/lib/validation/uuid";
import { loadLearnSet } from "@/lib/practice/learnEngine";
import { QuestionNotAvailableError } from "@/lib/practice/testEngine";
import { hasPracticeBanks } from "@/lib/practice/practiceBanks";
import { parseCountParam } from "@/lib/practice/questionCount";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";

import { PracticeRunner } from "./PracticeRunner";

/**
 * Practice: the chosen number of questions on one scrollable page, as expandable
 * cards (`?count=N&s=seed`: N questions picked at random from the type's bank, the
 * same ones on every refresh). Questions arrive WITHOUT their answers; a question's answer is
 * fetched only when the student presses Answer on it (see learnActions.ts).
 * Practice is tracked separately from Test.
 */
export default async function PracticeSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; setId: string }>;
  searchParams: Promise<{ count?: string | string[]; s?: string | string[] }>;
}) {
  const { type, setId } = await params;
  const { count, s } = await searchParams;
  const seedRaw = Array.isArray(s) ? s[0] : s;
  const wanted = parseCountParam(count);
  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type) || !isUuid(setId)) {
    notFound();
  }

  let set;
  try {
    set = await loadLearnSet(
      user,
      type as QuestionType,
      setId,
      wanted !== undefined ? { count: wanted, seed: (seedRaw ?? "").slice(0, 40) } : undefined,
    );
  } catch (err) {
    if (err instanceof QuestionNotAvailableError) notFound();
    throw err;
  }

  return (
    <PracticeRunner
      type={type}
      setId={set.setId}
      title={hasPracticeBanks(type as QuestionType) ? set.title : "Practice"}
      typeLabel={QUESTION_TYPE_LABELS[set.type]}
      listHref={`/practice/${type}/learn`}
      listLabel={hasPracticeBanks(type as QuestionType) ? "Switch bank" : "New practice"}
      questions={set.questions}
    />
  );
}
