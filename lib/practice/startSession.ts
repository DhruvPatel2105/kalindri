"use server";

/**
 * Starts a one-shot practice session for a single question — session 10A's
 * minimal "start, answer, submit" engine. No timers, no multi-item
 * sessions, no queue, no LLM; every future module (Write Email included)
 * builds on this same engine.
 *
 * CRITICAL — content protection (CLAUDE.md): picks exactly ONE question
 * server-side (the candidate-selection query never leaves this function).
 * Only that one full payload ever crosses this Server Action's boundary.
 */

import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { questions, sessions } from "@/lib/db/schema";
import { questionSchemas } from "@/lib/questions/schemas";
import type { QuestionType } from "@/lib/questions/types";

import { buildSessionState } from "./sessionState";

export interface StartSessionResult<T extends QuestionType = QuestionType> {
  sessionId: string;
  question: {
    id: string;
    type: T;
    payload: z.infer<(typeof questionSchemas)[T]>;
  };
}

export async function startSession<T extends QuestionType>(
  type: T,
): Promise<StartSessionResult<T>> {
  const user = await requireActiveSession();
  const db = getDb();

  // Exactly one random, published, active question of this type, scoped to
  // the caller's org — this candidate-selection query is the ONLY place
  // that ever sees more than one question, and it never leaves this
  // function.
  const [question] = await db
    .select({
      id: questions.id,
      type: questions.type,
      payload: questions.payload,
    })
    .from(questions)
    .where(
      and(
        eq(questions.orgId, user.orgId),
        eq(questions.type, type),
        eq(questions.status, "published"),
        eq(questions.isActive, true),
      ),
    )
    .orderBy(sql`random()`)
    .limit(1);

  if (!question) {
    throw new Error(
      `No published, active question of type ${type} is available.`,
    );
  }

  const now = new Date();

  const [session] = await db
    .insert(sessions)
    .values({
      orgId: user.orgId,
      userId: user.id,
      mode: "practice",
      questionIds: [question.id],
      currentItemIndex: 0,
      // submitAttempt.ts grades against THIS snapshot, not a re-fetch, so a
      // later edit to the question can't change what this attempt is
      // scored against.
      state: buildSessionState({
        id: question.id,
        type: question.type,
        payload: question.payload,
      }),
      isTimed: false,
      status: "in_progress",
      startedAt: now,
    })
    .returning({ id: sessions.id });

  if (!session) {
    throw new Error("Failed to create practice session.");
  }

  return {
    sessionId: session.id,
    question: {
      id: question.id,
      // `question.type` is guaranteed === `type` by the eq() filter above.
      // `payload` is trusted as already Zod-validated at question-authoring
      // time — this is a read, not that boundary, so it isn't re-verified
      // here.
      type: question.type as T,
      payload: question.payload as z.infer<(typeof questionSchemas)[T]>,
    },
  };
}
