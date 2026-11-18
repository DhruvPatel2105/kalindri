import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { loadLearnSet } from "@/lib/practice/learnEngine";
import { QuestionNotAvailableError } from "@/lib/practice/testEngine";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { TYPE_LABELS } from "../../typeLabels";
import { PracticeRunner } from "./PracticeRunner";

/**
 * Practice: every question of a set on one scrollable page, as expandable
 * cards. Questions arrive WITHOUT their answers; a question's answer is
 * fetched only when the student presses Answer on it (see learnActions.ts).
 * Practice is tracked separately from Test.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PracticeSetPage({
  params,
}: {
  params: Promise<{ type: string; setId: string }>;
}) {
  const { type, setId } = await params;
  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type) || !UUID_RE.test(setId)) {
    notFound();
  }

  let set;
  try {
    set = await loadLearnSet(user, type as QuestionType, setId);
  } catch (err) {
    if (err instanceof QuestionNotAvailableError) notFound();
    throw err;
  }

  return (
    <PracticeRunner
      type={type}
      setId={set.setId}
      title={set.title}
      typeLabel={TYPE_LABELS[set.type] ?? set.type}
      listHref={`/practice/${type}/learn/sets`}
      questions={set.questions}
    />
  );
}
