"use server";

/**
 * Student-callable mutations for the practice-test engine. These are public
 * endpoints, so each one authenticates and hands the user to testEngine.ts,
 * which re-checks that the session belongs to them and is still open. Nothing
 * here returns question content: the answer key never travels back out.
 */

import { requireActiveSession } from "@/lib/auth/requireActiveSession";

import { finishTest, saveTestProgress, saveTestTimings, startRetry } from "./testEngine";

export type ActionResult = { ok: true } | { ok: false; error: string };

function failure(err: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

/** Autosave: the student's answer to one question and/or their position. */
export async function saveProgress(input: {
  sessionId: string;
  currentIndex: number;
  answer?: { questionId: string; response: unknown };
}): Promise<ActionResult> {
  const user = await requireActiveSession();
  try {
    await saveTestProgress(user, input);
    return { ok: true };
  } catch (err) {
    return failure(err, "Couldn't save your answer.");
  }
}

/**
 * Time-per-question autosave: cumulative active seconds per question id.
 * Best effort — a failure here never blocks answering or submitting.
 */
export async function saveTimings(input: {
  sessionId: string;
  timings: Record<string, number>;
}): Promise<ActionResult> {
  const user = await requireActiveSession();
  try {
    await saveTestTimings(user, input);
    return { ok: true };
  } catch (err) {
    return failure(err, "Couldn't save timing.");
  }
}

/** Submit Test. Idempotent: submitting an already-submitted test succeeds. */
export async function submitTest(sessionId: string): Promise<ActionResult> {
  const user = await requireActiveSession();
  try {
    await finishTest(user, sessionId);
    return { ok: true };
  } catch (err) {
    return failure(err, "Couldn't submit the test.");
  }
}

/**
 * "Practise incorrect questions": starts (or resumes) a retry made of the
 * questions the finished test didn't get full marks on. Returns the new
 * session's id; the caller navigates to it.
 */
export async function startRetryAction(
  parentSessionId: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const user = await requireActiveSession();
  try {
    const { sessionId } = await startRetry(user, parentSessionId);
    return { ok: true, sessionId };
  } catch (err) {
    return failure(err, "Couldn't start the retry.");
  }
}
