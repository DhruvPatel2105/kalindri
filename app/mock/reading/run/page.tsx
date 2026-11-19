import { notFound, redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { toClientQuestion } from "@/lib/practice/clientQuestion";
import { secondsRemaining } from "@/lib/practice/mock";
import { startOrResumeMock } from "@/lib/practice/mockEngine";
import { finishTest, QuestionNotAvailableError } from "@/lib/practice/testEngine";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";

import { TestRunner } from "../../../practice/[type]/[setId]/TestRunner";

/**
 * The Reading mock exam. Starting creates the mock (or resumes the unfinished
 * one at the exact question the student left). If the clock ran out while the
 * student was away, the mock is submitted as it stands and they go straight
 * to the results. Only this student's own mock is sent, with every answer key
 * stripped by toClientQuestion.
 */
export default async function ReadingMockRunPage() {
  const user = await requireActiveSession();

  let mock;
  try {
    mock = await startOrResumeMock(user);
  } catch (err) {
    if (err instanceof QuestionNotAvailableError) notFound();
    throw err;
  }

  const now = new Date();
  const resultsHref = `/mock/reading/results/${mock.sessionId}`;
  if (secondsRemaining(mock.deadline, now) === 0) {
    await finishTest(user, mock.sessionId);
    redirect(resultsHref);
  }

  return (
    <TestRunner
      sessionId={mock.sessionId}
      title="Reading Mock Test"
      typeLabel="Reading"
      listHref="/mock/reading"
      resultsHref={resultsHref}
      initialIndex={mock.currentIndex}
      initialAnswers={mock.answers}
      questions={mock.snapshots.map((snapshot) => toClientQuestion(snapshot))}
      mock={{
        deadlineIso: mock.deadline.toISOString(),
        serverNowIso: now.toISOString(),
        typeLabels: mock.snapshots.map((snapshot) => QUESTION_TYPE_LABELS[snapshot.type]),
      }}
    />
  );
}
