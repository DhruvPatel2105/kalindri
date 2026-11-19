/**
 * Bulk question importer — institute-written Reading questions from a plain
 * text file into the `questions` table.
 *
 * Run with:
 *   npm run import-questions -- <kind> <file> [--dry-run] [--publish]
 *
 *   kind:  reorder       REORDER_PARAGRAPH            (lib/import/parseReorder.ts)
 *          fib-drag      FIB_READING, word bank       (lib/import/parseFibDrag.ts)
 *          fib-dropdown  FIB_RW, option list/blank    (lib/import/parseFibDropdown.ts)
 *          mcm-reading   MCM_READING, multiple answers (lib/import/parseMcm.ts)
 *          mcs-reading   MCS_READING, single answer    (lib/import/parseMcm.ts)
 *
 * Each parser's header documents its exact file format; working examples are
 * in import-templates/. Keep your real files in import-data/ (git-ignored) —
 * the question bank must not end up in the repository.
 *
 * Difficulty: a comment line that is just `// EASY`, `// MEDIUM` or `// HARD`
 * sets the difficulty of every question below it until the next marker. It is
 * stored on the question. On an already-imported question it is filled in only
 * if the question has no difficulty yet — a rating is never overwritten.
 * `--difficulty-only` does just that for questions already in the database:
 * it sets missing difficulties and never inserts, publishes or changes content.
 *
 * Safe by design:
 *   - Every question is parsed and validated against its real Zod schema
 *     FIRST. If anything is wrong, all problems are printed and NOTHING is
 *     inserted — fix the file and re-run.
 *   - `--dry-run` stops after validation (no database connection at all).
 *   - Idempotent: a question whose external_id already exists is skipped,
 *     never duplicated or overwritten (content is never changed on re-run). IDs are <PREFIX>-<number padded to 3>,
 *     e.g. REORDER-INST-007 for "#7" in a reorder file.
 *   - Imported as DRAFT unless `--publish` is given — practice only serves
 *     published questions, so review with --dry-run, then re-run with
 *     --publish. `is_seed_data` is false (these are real content), and
 *     source = "institute" with the file's title kept in source_notes.
 *
 * Standalone, same as lib/db/seed.ts and lib/db/seedQuestions.ts: opens its
 * own connection rather than importing lib/db (server-only).
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { ParsedFile } from "@/lib/import/blocks";
import { parseFibDragFile } from "@/lib/import/parseFibDrag";
import { parseFibDropdownFile } from "@/lib/import/parseFibDropdown";
import { parseMcmFile, parseMcsFile } from "@/lib/import/parseMcm";
import { parseReorderFile } from "@/lib/import/parseReorder";

import { organizations, questions } from "./schema";

const ORG_SLUG = "kalindri"; // must match lib/db/seed.ts's ORG_SLUG
const READING_PART = 2; // lib/questions/types.ts PART_BY_TYPE

const KINDS = {
  reorder: {
    type: "REORDER_PARAGRAPH",
    prefix: "REORDER-INST",
    parse: (text: string): ParsedFile<unknown> => parseReorderFile(text),
  },
  "fib-drag": {
    type: "FIB_READING",
    prefix: "FIB-READING-INST",
    parse: (text: string): ParsedFile<unknown> => parseFibDragFile(text),
  },
  "fib-dropdown": {
    type: "FIB_RW",
    prefix: "FIB-RW-INST",
    parse: (text: string): ParsedFile<unknown> => parseFibDropdownFile(text),
  },
  "mcm-reading": {
    type: "MCM_READING",
    prefix: "MCM-READING-INST",
    parse: (text: string): ParsedFile<unknown> => parseMcmFile(text),
  },
  "mcs-reading": {
    type: "MCS_READING",
    prefix: "MCS-READING-INST",
    parse: (text: string): ParsedFile<unknown> => parseMcsFile(text),
  },
} as const;

type Kind = keyof typeof KINDS;

function isKind(value: string): value is Kind {
  return value in KINDS;
}

const USAGE =
  "Usage: npm run import-questions -- <reorder|fib-drag|fib-dropdown|mcm-reading|mcs-reading> <file> [--dry-run] [--publish] [--difficulty-only]";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      publish: { type: "boolean", default: false },
      "difficulty-only": { type: "boolean", default: false },
    },
  });

  const [kindArg, filePath] = positionals;
  if (!kindArg || !filePath || !isKind(kindArg)) throw new Error(USAGE);
  const kind = KINDS[kindArg];

  const parsed = kind.parse(readFileSync(filePath, "utf8"));

  const problems: string[] = parsed.fileErrors.map((e) => `File: ${e}`);
  for (const item of parsed.items) {
    if (!item.ok) {
      for (const error of item.errors) {
        problems.push(`#${item.number} "${item.title}": ${error}`);
      }
    }
  }

  const valid = parsed.items.flatMap((item) => (item.ok ? [item] : []));
  console.log(
    `Parsed ${parsed.items.length} question(s): ${valid.length} valid, ` +
      `${parsed.items.length - valid.length} with problems.`,
  );

  if (problems.length > 0) {
    console.error("\nProblems found — nothing was imported:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    throw new Error(`${problems.length} problem(s). Fix the file and re-run.`);
  }

  if (values["dry-run"]) {
    console.log("Dry run: all questions are valid. Nothing written.");
    return;
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
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);
    if (!org) {
      throw new Error(
        `No organization found with slug "${ORG_SLUG}". Run "npm run db:seed" first.`,
      );
    }

    const status = values.publish ? "published" : "draft";
    let inserted = 0;
    let published = 0;
    let skipped = 0;
    let difficultySet = 0;

    for (const item of valid) {
      const externalId = `${kind.prefix}-${String(item.number).padStart(3, "0")}`;

      const [existing] = await db
        .select({
          id: questions.id,
          status: questions.status,
          difficulty: questions.difficulty,
        })
        .from(questions)
        .where(
          and(eq(questions.orgId, org.id), eq(questions.externalId, externalId)),
        )
        .limit(1);
      if (existing) {
        // A difficulty from the file fills a missing one; an existing rating
        // is never overwritten (a mismatch is reported, not applied).
        if (item.difficulty && existing.difficulty === null) {
          await db
            .update(questions)
            .set({ difficulty: item.difficulty })
            .where(eq(questions.id, existing.id));
          console.log(`Set difficulty of ${externalId} to ${item.difficulty}.`);
          difficultySet++;
        } else if (item.difficulty && existing.difficulty !== item.difficulty) {
          console.log(
            `Note: ${externalId} is rated ${existing.difficulty} in the database but ${item.difficulty} in the file — left as is.`,
          );
        }
        if (values["difficulty-only"]) continue;
        // Never overwrite content; --publish only promotes an existing draft.
        if (values.publish && existing.status === "draft") {
          await db
            .update(questions)
            .set({ status: "published" })
            .where(eq(questions.id, existing.id));
          console.log(`Published existing draft ${externalId}.`);
          published++;
        } else {
          console.log(`Skipping ${externalId} — already imported.`);
          skipped++;
        }
        continue;
      }

      if (values["difficulty-only"]) {
        console.log(`Skipping ${externalId} — not in the database (--difficulty-only never inserts).`);
        skipped++;
        continue;
      }

      await db.insert(questions).values({
        orgId: org.id,
        externalId,
        type: kind.type,
        part: READING_PART,
        payload: item.payload,
        difficulty: item.difficulty,
        status,
        isActive: true,
        source: "institute",
        sourceNotes: item.title ? `Title: ${item.title}` : null,
        isSeedData: false,
      });
      console.log(`Inserted ${externalId} as ${status}.`);
      inserted++;
    }

    console.log(
      `Done: ${inserted} inserted, ${published} existing draft(s) published, ${difficultySet} difficulty value(s) set, ${skipped} skipped.`,
    );
    if (inserted > 0 && status === "draft") {
      console.log(
        "Imported as DRAFT — students can't see them yet. Re-run with --publish to make them live.",
      );
    }
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
