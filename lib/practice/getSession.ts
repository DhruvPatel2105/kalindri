import "server-only";

/**
 * Read helper (not a Server Action) so the practice page can re-render on
 * reload without losing state. Re-fetches the session's CURRENT question
 * fresh from `questions` — a display concern, distinct from
 * submitAttempt.ts's use of the session's STORED snapshot for grading
 * integrity (see lib/practice/sessionState.ts). A fresh re-fetch here is
 * fine: nothing has been graded yet at this point.
 */

import { eq } from "drizzle-orm";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { questions, sessions } from "@/lib/db/schema";

export interface CurrentSession {
  sessionId: string;
  status: (typeof sessions.$inferSelect)["status"];
  question: {
    id: string;
    type: (typeof questions.$inferSelect)["type"];
    payload: unknown;
  };
}

export async function getSession(sessionId: string): Promise<CurrentSession> {
  const user = await requireActiveSession();
  const db = getDb();

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  // Never trust a client-supplied ownership claim — same error whether the
  // session doesn't exist at all or belongs to someone else.
  if (!session || session.userId !== user.id) {
    throw new Error("Session not found.");
  }

  const questionId = session.questionIds?.[session.currentItemIndex];
  if (!questionId) {
    throw new Error("Session has no current question.");
  }

  // A single lookup by id — never a list of question payloads across this
  // boundary (CLAUDE.md content protection).
  const [question] = await db
    .select({
      id: questions.id,
      type: questions.type,
      payload: questions.payload,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    throw new Error("Question not found.");
  }

  return {
    sessionId: session.id,
    status: session.status,
    question,
  };
}
