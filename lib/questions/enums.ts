/**
 * Enum values shared by the database schema (lib/db/schema.ts builds its
 * Postgres enums from these) and the question payload schemas (Zod). Kept in
 * a plain module with no database imports so the payload schemas — and the
 * answer-review code built on them — can also run in the browser.
 */

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const QUESTION_ACCENTS = ["en-CA", "en-GB", "en-US", "en-AU"] as const;
