/** The colours a student can bookmark a question with. Shared by the browser and the server. */

export const BOOKMARK_COLORS = ["red", "orange", "yellow", "green"] as const;

export type BookmarkColor = (typeof BOOKMARK_COLORS)[number];

export function isBookmarkColor(value: unknown): value is BookmarkColor {
  return typeof value === "string" && (BOOKMARK_COLORS as readonly string[]).includes(value);
}
