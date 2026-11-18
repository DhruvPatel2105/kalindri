import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { toClientQuestion } from "@/lib/practice/clientQuestion";
import { parseCountParam } from "@/lib/practice/questionCount";
import {
  QuestionNotAvailableError,
  startOrResumeTest,
  type ActiveTest,
} from "@/lib/practice/testEngine";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { TYPE_LABELS } from "../typeLabels";
import { TestRunner } from "./TestRunner";

/**
 * The practice test: one question set, answered in any order, submitted once.
 * Starting creates a session (recording its start time) or resumes the
 * student's unfinished one for this set. Submitting (TestRunner → submitTest)
 * records the completion time and sends the student to the results page.
 *
 * The set id comes from the URL, so it's validated (uuid) and then checked by
 * the engine against org / type / published / active — an id for another
 * type, a draft or another org's set is a 404, never a payload.
 *
 * How many questions: `?count=N` sits N of the set's questions (random, in set
 * order); no count, or more than the set has, sits the whole set. An unfinished
 * test is resumed with the questions it started with, whatever the count.
 *
 * Content protection: only this one set's questions are sent, only through
 * the student's own session, and toClientQuestion strips every answer key
 * before they reach the browser.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PracticeTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; setId: string }>;
  searchParams: Promise<{ count?: string | string[] }>;
}) {
  const { type, setId } = await params;
  const { count } = await searchParams;

  const user = await requireActiveSession();

  if (
    !(QUESTION_TYPES as readonly string[]).includes(type) ||
    !UUID_RE.test(setId)
  ) {
    notFound();
  }

  let test: ActiveTest;
  try {
    test = await startOrResumeTest(user, type as QuestionType, setId, {
      count: parseCountParam(count),
    });
  } catch (err) {
    if (err instanceof QuestionNotAvailableError) notFound();
    throw err;
  }

  return (
    <TestRunner
      sessionId={test.sessionId}
      title={test.setTitle}
      typeLabel={TYPE_LABELS[test.type] ?? test.type}
      listHref={`/practice/${type}/tests`}
      resultsHref={`/practice/${type}/${setId}/results/${test.sessionId}`}
      initialIndex={test.currentIndex}
      initialAnswers={test.answers}
      questions={test.snapshots.map((snapshot) => toClientQuestion(snapshot))}
    />
  );
}
