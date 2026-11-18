import { notFound, redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { toClientQuestion } from "@/lib/practice/clientQuestion";
import { loadRetrySession, TestSessionError } from "@/lib/practice/testEngine";
import { QUESTION_TYPES } from "@/lib/questions/types";

import { TYPE_LABELS } from "../../../typeLabels";
import { TestRunner } from "../../TestRunner";

/**
 * Runs a retry ("Practise incorrect questions"): the same test runner, over
 * only the questions an earlier test didn't get full marks on. Reached from
 * the results dashboard; answers autosave and submit exactly like a normal
 * test, and a finished retry goes to its own results page, where it can be
 * retried again.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RetryTestPage({
  params,
}: {
  params: Promise<{ type: string; setId: string; sessionId: string }>;
}) {
  const { type, setId, sessionId } = await params;

  const user = await requireActiveSession();

  if (
    !(QUESTION_TYPES as readonly string[]).includes(type) ||
    !UUID_RE.test(setId) ||
    !UUID_RE.test(sessionId)
  ) {
    notFound();
  }

  let test;
  try {
    test = await loadRetrySession(user, sessionId);
  } catch (err) {
    if (err instanceof TestSessionError) notFound();
    throw err;
  }

  // The URL must describe the session it points at.
  if (test.type !== type || test.setId !== setId || !test.retryOfSessionId) {
    notFound();
  }

  if (test.status !== "in_progress") {
    redirect(`/practice/${type}/${setId}/results/${sessionId}`);
  }

  return (
    <TestRunner
      sessionId={test.sessionId}
      title={test.setTitle}
      typeLabel={TYPE_LABELS[test.type] ?? test.type}
      // Leaving a retry goes back to the results it came from; progress is saved.
      listHref={`/practice/${type}/${setId}/results/${test.retryOfSessionId}`}
      resultsHref={`/practice/${type}/${setId}/results/${test.sessionId}`}
      initialIndex={test.currentIndex}
      initialAnswers={test.answers}
      questions={test.snapshots.map((snapshot) => toClientQuestion(snapshot))}
    />
  );
}
