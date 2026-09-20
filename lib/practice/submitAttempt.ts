"use server";

/**
 * Submits the one response for a one-item practice session — session 10A's
 * minimal engine. CLAUDE.md rules baked in here:
 *
 *   - Never lose an attempt (#12): the `attempts` row is inserted with the
 *     raw response BEFORE any scoring is attempted. If scoring throws for
 *     any reason after the insert, the response is already safe.
 *   - Deterministic scoring runs before any LLM call (#3) — moot here since
 *     there's no LLM call in this session at all, but the ordering already
 *     matches: deterministic scoring is the only scoring this session does,
 *     and it runs synchronously, inline, after the attempt is persisted.
 *     This is NOT the queued LLM/speech path rule #7 describes; that rule
 *     doesn't apply to deterministic scoring, which is instant and free.
 *   - Always persist raw model output (#6): the full raw scorer result is
 *     written to `score_runs`, separate from the summarized `scores` row.
 *
 * Grades against the snapshot captured in sessions.state at startSession.ts
 * time — never a fresh re-fetch of `questions`, and never a snapshot
 * supplied by the client (that would let a client tamper with the grading
 * key). See lib/practice/sessionState.ts.
 */

import { eq } from "drizzle-orm";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { attempts, scoreRuns, scores, sessions } from "@/lib/db/schema";
import {
  isDeterministicType,
  scoreDeterministic,
  type DeterministicScoreResult,
} from "@/lib/scoring/registry";

import { validateDeterministicResponse } from "./responseSchemas";
import { extractQuestionSnapshot } from "./sessionState";

export interface SubmitAttemptResult {
  attemptId: string;
  scored: boolean;
  result?: DeterministicScoreResult;
  message?: string;
  /**
   * The question payload this attempt was graded against. Safe to send to
   * the client only from HERE — after the attempt is already recorded and
   * (if applicable) already scored — never earlier: sending it as part of
   * the initial question render would leak the answer key (e.g.
   * `correct_option_id`) before the student submits. Lets a UI show what
   * the correct answer was without the shared engine baking in any
   * per-type "reveal" logic itself.
   */
  questionSnapshot: unknown;
}

export async function submitAttempt(
  sessionId: string,
  response: unknown,
): Promise<SubmitAttemptResult> {
  const user = await requireActiveSession();
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  // Never trust a client-supplied ownership claim.
  if (!session || session.userId !== user.id) {
    throw new Error("Session not found.");
  }

  if (session.status !== "in_progress") {
    throw new Error("This session has already been completed.");
  }

  const questionId = session.questionIds?.[session.currentItemIndex];
  if (!questionId) {
    throw new Error("Session has no current question.");
  }

  const snapshot = extractQuestionSnapshot(session.state);
  if (!snapshot) {
    throw new Error("Session is missing its question snapshot.");
  }
  const { type: questionType, payload: questionPayload } = snapshot;

  // Reject malformed input before touching the database. Only deterministic
  // types have a response schema yet (llm/speech scorers don't exist —
  // this session only wires deterministic types end-to-end), so a
  // non-deterministic response is passed through as-is rather than
  // rejected against a schema that doesn't exist.
  let responseToStore: unknown = response ?? null;
  if (isDeterministicType(questionType)) {
    const validation = validateDeterministicResponse(questionType, response);
    if (!validation.success) {
      throw new Error(`Invalid response: ${validation.error}`);
    }
    responseToStore = validation.data;
  }

  const now = new Date();

  // Insert the attempt FIRST — never lose an attempt. The response is safe
  // here even if scoring throws next.
  const [attempt] = await db
    .insert(attempts)
    .values({
      orgId: user.orgId,
      sessionId: session.id,
      userId: user.id,
      questionId,
      questionSnapshot: questionPayload,
      response: responseToStore,
      status: "submitted",
      countsTowardStats: true,
      startedAt: session.startedAt,
      submittedAt: now,
    })
    .returning({ id: attempts.id });

  if (!attempt) {
    throw new Error("Failed to record attempt.");
  }

  // Every session in this part has exactly one item, so submitting always
  // completes it — regardless of whether this type is scorable yet.
  await db
    .update(sessions)
    .set({ status: "completed", completedAt: now })
    .where(eq(sessions.id, session.id));

  if (!isDeterministicType(questionType)) {
    return {
      attemptId: attempt.id,
      scored: false,
      message: "Scoring not yet available for this question type.",
      questionSnapshot: questionPayload,
    };
  }

  // Safe: the DB guarantees questionPayload matches questionType (both came
  // from the same snapshot written by startSession.ts for this exact type),
  // and validateDeterministicResponse above already confirmed
  // responseToStore's shape for this exact type — matching payload/response
  // to questionType here is the caller's responsibility, same as
  // lib/scoring/registry.ts's own internal use of this pattern.
  const result = scoreDeterministic(
    questionType,
    questionPayload as never,
    responseToStore as never,
  );

  await db.insert(scores).values({
    orgId: user.orgId,
    attemptId: attempt.id,
    trait: "overall",
    score: String(result.score),
    maxScore: String(result.maxScore),
    scorerVersion: "deterministic-v1",
  });

  await db.insert(scoreRuns).values({
    orgId: user.orgId,
    attemptId: attempt.id,
    scorerType: "deterministic",
    rawOutput: result,
    status: "success",
  });

  return {
    attemptId: attempt.id,
    scored: true,
    result,
    questionSnapshot: questionPayload,
  };
}
