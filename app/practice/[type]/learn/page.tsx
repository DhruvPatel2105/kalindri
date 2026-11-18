import { notFound, redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { pickPracticeSetId } from "@/lib/practice/learnEngine";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { SetBrowser } from "../SetBrowser";

/**
 * Choosing Practice skips any list: it goes straight to the practice page of
 * the set the student last practised (else the first set). Another set can be
 * chosen from there ("Change set", /learn/sets). A type with no published
 * set shows the empty set list instead.
 */
export default async function PracticeEntryPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) notFound();

  const setId = await pickPracticeSetId(user, type as QuestionType);
  if (setId) redirect(`/practice/${type}/learn/${setId}`);

  return <SetBrowser type={type} pageParam={undefined} mode="learn" />;
}
