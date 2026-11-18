"use server";

/** The bookmark colour picker. Authenticates, validates the colour, and only ever touches the caller's own bookmark. */

import { requireActiveSession } from "@/lib/auth/requireActiveSession";

import { isBookmarkColor } from "./bookmarkColors";
import { setBookmark } from "./bookmarks";

export type BookmarkResult = { ok: true } | { ok: false; error: string };

/** `color` null removes the bookmark. */
export async function setBookmarkAction(input: {
  questionId: string;
  color: string | null;
}): Promise<BookmarkResult> {
  const user = await requireActiveSession();
  if (input.color !== null && !isBookmarkColor(input.color)) {
    return { ok: false, error: "Unknown bookmark colour." };
  }
  try {
    await setBookmark(user, input.questionId, input.color);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save the bookmark." };
  }
}
