import "server-only";

/**
 * A student's coloured bookmarks on questions (red, orange, yellow, green).
 * One bookmark per student per question: choosing another colour changes it,
 * choosing none removes it. Only the question's id is stored — never its
 * content — and a student only ever reads and writes their own.
 */

import { and, eq } from "drizzle-orm";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { questionBookmarks, questions } from "@/lib/db/schema";

import type { BookmarkColor } from "./bookmarkColors";

type SessionUser = Awaited<ReturnType<typeof requireActiveSession>>;

/** The question isn't visible to this student (unknown id, another org, unpublished). */
export class BookmarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookmarkError";
  }
}

/** Sets the bookmark colour of a question, or removes it when `color` is null. */
export async function setBookmark(
  user: SessionUser,
  questionId: string,
  color: BookmarkColor | null,
): Promise<void> {
  const db = getDb();

  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.orgId, user.orgId),
        eq(questions.status, "published"),
        eq(questions.isActive, true),
      ),
    )
    .limit(1);
  if (!question) throw new BookmarkError("That question isn't available.");

  if (color === null) {
    await db
      .delete(questionBookmarks)
      .where(
        and(eq(questionBookmarks.userId, user.id), eq(questionBookmarks.questionId, questionId)),
      );
    return;
  }

  await db
    .insert(questionBookmarks)
    .values({ orgId: user.orgId, userId: user.id, questionId, color })
    .onConflictDoUpdate({
      target: [questionBookmarks.userId, questionBookmarks.questionId],
      set: { color, updatedAt: new Date() },
    });
}
