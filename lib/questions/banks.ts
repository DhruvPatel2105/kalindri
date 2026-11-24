/**
 * Named question banks inside one question type. A bank is just a tag on the
 * question (`questions.tags`) — no extra table, and the one `questions` table
 * stays the home of every question (CLAUDE.md #1).
 *
 *   bank:main       the original Fill in the Blanks questions
 *   bank:secondary  the additional ones
 *
 * Practice and Test both offer each bank on its own; Test also offers all the
 * banks together (lib/practice/testBanks.ts).
 */

export const BANK_MAIN_TAG = "bank:main";
export const BANK_SECONDARY_TAG = "bank:secondary";
