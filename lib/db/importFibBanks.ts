/**
 * Loads the two-bank Fill in the Blanks file into the database.
 *
 * Run with:
 *   npm run import-fib-banks -- [file] [--dry-run]
 *
 * file defaults to import-data/pte_fib_question_banks.json (git-ignored — the
 * question bank must not end up in the repository).
 *
 *   - mainBank: the original 15 questions ALREADY live in the database (the
 *     institute import, FIB-RW-INST-001…015). They are matched by title, their
 *     answers are checked against the file's (a mismatch is reported, nothing
 *     is changed), and they are tagged bank:main. The file's main bank is
 *     missing the choices for 10 blanks, so the database versions are the
 *     complete ones and are kept as they are.
 *   - secondaryBank: the 46 additional questions are inserted as published
 *     FIB_RW questions (FIB-RW-SEC-0NN, by the file's number), tagged
 *     bank:secondary so they are for Practice only and never drawn into Tests.
 *     An existing question is never overwritten. Answers are never changed;
 *     only the ORDER of each blank's options is shuffled.
 *   - two published question sets — "Main Question Bank" and "Secondary
 *     Question Bank" — list each bank's questions in numbered order, which is
 *     what the Practice page opens.
 *
 * Safe by design: everything is validated first (nothing is written if
 * anything is wrong), --dry-run touches no database, and re-running is
 * idempotent.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { banksFileSchema, mapBank } from "@/lib/import/parseFibBanks";
import { BANK_MAIN_TAG, BANK_SECONDARY_TAG } from "@/lib/questions/banks";
import { PRACTICE_BANKS } from "@/lib/practice/practiceBanks";

import { organizations, questions, questionSets } from "./schema";

const ORG_SLUG = "kalindri";
const FIB_RW_PART = 1; // lib/questions/types.ts PART_BY_TYPE (Speaking & Writing)
const MAIN_SET_TITLE = PRACTICE_BANKS.FIB_RW?.[0]?.setTitle ?? "Main Question Bank";
const SECONDARY_SET_TITLE = PRACTICE_BANKS.FIB_RW?.[1]?.setTitle ?? "Secondary Question Bank";

const pad = (n: number) => String(n).padStart(3, "0");

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const filePath = positionals[0] ?? "import-data/pte_fib_question_banks.json";

  const parsedFile = banksFileSchema.safeParse(JSON.parse(readFileSync(filePath, "utf8")));
  if (!parsedFile.success) {
    throw new Error(`The file isn't in the expected shape:\n${parsedFile.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const main = mapBank("mainBank", parsedFile.data.mainBank);
  const secondary = mapBank("secondaryBank", parsedFile.data.secondaryBank);
  // The file's main bank is only used to cross-check the questions already in
  // the database, so its problems are reported but don't stop the import; the
  // secondary bank is what gets written, so ITS problems do.
  for (const p of main.problems) console.warn(`Note: file main bank ${p.id}: ${p.errors.join(" ")} (the database version is used)`);
  if (secondary.problems.length > 0) {
    for (const p of secondary.problems) console.error(`  - ${p.bank} ${p.id}: ${p.errors.join(" ")}`);
    throw new Error(`${secondary.problems.length} secondary question(s) have problems. Fix the file and re-run — nothing was imported.`);
  }
  console.log(
    `Validated: main ${main.questions.length} of ${parsedFile.data.mainBank.length} questions, secondary ${secondary.questions.length} questions ` +
      `(${secondary.questions.reduce((sum, q) => sum + q.payload.blanks.length, 0)} blanks).`,
  );
  const typed = [...main.questions, ...secondary.questions].reduce((sum, q) => sum + q.typedBlanks, 0);
  console.log(`Blanks without choices in the file (typed answers): ${typed} (main bank only; the database versions have all choices).`);

  if (values["dry-run"]) {
    console.log("Dry run: nothing written.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.local).");
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, ORG_SLUG)).limit(1);
    if (!org) throw new Error(`No organization "${ORG_SLUG}".`);

    // ── main bank: the questions already in the database ──
    const mainRows = await db
      .select({ id: questions.id, externalId: questions.externalId, sourceNotes: questions.sourceNotes, payload: questions.payload })
      .from(questions)
      .where(and(eq(questions.orgId, org.id), eq(questions.type, "FIB_RW"), eq(questions.status, "published")));
    const mainIds: string[] = [];
    for (const fileQuestion of [...parsedFile.data.mainBank].sort((x, y) => x.number - y.number)) {
      const row = mainRows.find((r) => r.externalId === `FIB-RW-INST-${pad(fileQuestion.number)}`);
      if (!row || row.sourceNotes !== `Title: ${fileQuestion.title}`) {
        throw new Error(`Main question ${fileQuestion.number} "${fileQuestion.title}" doesn't match a database question (FIB-RW-INST-${pad(fileQuestion.number)}). Nothing changed.`);
      }
      const dbAnswers = [...(row.payload as { blanks: { index: number; correct_option: string }[] }).blanks]
        .sort((x, y) => x.index - y.index)
        .map((blank) => blank.correct_option.toLowerCase());
      const fileAnswers = [...fileQuestion.blanks].sort((x, y) => x.blank - y.blank).map((blank) => blank.answer.toLowerCase());
      if (dbAnswers.join("|") !== fileAnswers.join("|")) {
        console.warn(`Note: main question ${fileQuestion.number} "${fileQuestion.title}" has different answers in the file and the database — database kept.`);
      }
      mainIds.push(row.id);
    }
    await db.update(questions).set({ tags: [BANK_MAIN_TAG] }).where(inArray(questions.id, mainIds));
    console.log(`Main bank: ${mainIds.length} existing questions tagged ${BANK_MAIN_TAG}.`);

    // ── secondary bank: insert what is missing ──
    const secondaryIds: string[] = [];
    let inserted = 0;
    for (const fileQuestion of secondary.questions) {
      const externalId = `FIB-RW-SEC-${pad(fileQuestion.number)}`;
      const [existing] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.orgId, org.id), eq(questions.externalId, externalId)))
        .limit(1);
      if (existing) {
        secondaryIds.push(existing.id);
        await db.update(questions).set({ tags: [BANK_SECONDARY_TAG] }).where(eq(questions.id, existing.id));
        continue;
      }
      const [row] = await db
        .insert(questions)
        .values({
          orgId: org.id,
          externalId,
          type: "FIB_RW",
          part: FIB_RW_PART,
          payload: fileQuestion.payload,
          tags: [BANK_SECONDARY_TAG],
          status: "published",
          isActive: true,
          source: "institute",
          sourceNotes: fileQuestion.sourceNotes,
          isSeedData: false,
        })
        .returning({ id: questions.id });
      if (!row) throw new Error(`Couldn't insert ${externalId}.`);
      secondaryIds.push(row.id);
      inserted++;
    }
    console.log(`Secondary bank: ${inserted} inserted, ${secondaryIds.length - inserted} already there.`);

    // ── the two practice sets, in numbered order ──
    for (const [title, ids] of [
      [MAIN_SET_TITLE, mainIds],
      [SECONDARY_SET_TITLE, secondaryIds],
    ] as const) {
      const [set] = await db
        .select({ id: questionSets.id })
        .from(questionSets)
        .where(and(eq(questionSets.orgId, org.id), eq(questionSets.type, "FIB_RW"), eq(questionSets.title, title), eq(questionSets.isBank, false)))
        .limit(1);
      if (set) {
        await db.update(questionSets).set({ questionIds: ids, status: "published", isActive: true, updatedAt: new Date() }).where(eq(questionSets.id, set.id));
        console.log(`Set "${title}": updated (${ids.length} questions).`);
      } else {
        await db.insert(questionSets).values({ orgId: org.id, type: "FIB_RW", title, questionIds: ids, status: "published", isActive: true, isBank: false });
        console.log(`Set "${title}": created (${ids.length} questions).`);
      }
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
