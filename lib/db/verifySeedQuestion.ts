/**
 * Standalone verification script — checks that a single seeded question's
 * deterministic scoring is internally consistent: selecting EXACTLY the
 * correct answer(s) must score score === maxScore === the correct-answer
 * count. Lets you sanity-check any specific seeded question's scoring
 * without a browser.
 *
 * Supports the three negative-marking types only — MCM_READING,
 * MCM_LISTENING, HIGHLIGHT_INCORRECT_WORDS — the ones where "the
 * correct-answer count" is unambiguous (their maxScore IS that count; see
 * the generalized test added alongside this in negativeMarking.test.ts).
 * Other deterministic types have a different relationship between payload
 * and maxScore (single-answer, per-word spelling, adjacent-pairs) and
 * aren't handled here — the script throws a clear error rather than
 * guessing at what "the correct answer" would mean for them.
 *
 * Run with:  npm run verify-question -- <question-id>
 *
 * Standalone, same as lib/db/seed.ts and lib/db/create-admin.ts: opens its
 * own connection rather than importing lib/db (server-only, won't load
 * outside the Next.js server runtime).
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { scoreDeterministic } from "@/lib/scoring/registry";

import { questions } from "./schema";

const SUPPORTED_TYPES = [
  "MCM_READING",
  "MCM_LISTENING",
  "HIGHLIGHT_INCORRECT_WORDS",
] as const;

type SupportedType = (typeof SUPPORTED_TYPES)[number];

function isSupportedType(type: string): type is SupportedType {
  return (SUPPORTED_TYPES as readonly string[]).includes(type);
}

/** `correct_option_ids` for the two MCM types, `altered_word_indices` for Highlight Incorrect Words. */
function extractCorrectSelections(
  type: SupportedType,
  payload: unknown,
): readonly (string | number)[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Question payload is not an object.");
  }

  if (type === "HIGHLIGHT_INCORRECT_WORDS") {
    const indices = (payload as { altered_word_indices?: unknown })
      .altered_word_indices;
    if (!Array.isArray(indices)) {
      throw new Error(
        "Expected payload.altered_word_indices to be an array.",
      );
    }
    return indices as number[];
  }

  const ids = (payload as { correct_option_ids?: unknown })
    .correct_option_ids;
  if (!Array.isArray(ids)) {
    throw new Error("Expected payload.correct_option_ids to be an array.");
  }
  return ids as string[];
}

async function main(): Promise<void> {
  const questionId = process.argv[2];
  if (!questionId) {
    throw new Error("Usage: npm run verify-question -- <question-id>");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
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
      throw new Error(`No question found with id "${questionId}".`);
    }

    if (!isSupportedType(question.type)) {
      throw new Error(
        `Question type "${question.type}" is not supported by this script. ` +
          `Supported: ${SUPPORTED_TYPES.join(", ")}.`,
      );
    }

    const correctSelections = extractCorrectSelections(
      question.type,
      question.payload,
    );

    console.log(`Question ${question.id} (${question.type})`);
    console.log(
      `Correct selections (${correctSelections.length}):`,
      correctSelections,
    );

    // Response set to EXACTLY the correct options — `as never` is safe
    // here for the same reason lib/practice/submitAttempt.ts's own call to
    // scoreDeterministic uses it: `type` is only known at runtime (fetched
    // from the DB, not a compile-time literal), but isSupportedType() has
    // already confirmed it's one of the three negative-marking types, and
    // payload/correctSelections come from that same question row.
    const result = scoreDeterministic(
      question.type,
      question.payload as never,
      correctSelections as never,
    );

    console.log("Scoring result:", result);

    const expected = correctSelections.length;
    if (result.score !== expected || result.maxScore !== expected) {
      throw new Error(
        `Inconsistent scoring: expected score === maxScore === ${expected} ` +
          `(the correct-answer count), got score=${result.score}, maxScore=${result.maxScore}.`,
      );
    }

    console.log(`OK: score === maxScore === ${expected}.`);
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
