/**
 * Makes the stored main-bank Fill in the Blanks questions match the answer file.
 *
 * Run with:
 *   npm run sync-fib-main -- [file] [--dry-run] [--skip "Title"]...
 *
 * file defaults to import-data/fib-rw-main.json (git-ignored). THE FILE WINS for
 * a stored question with the same title: its passage, correct answers,
 * difficulty and title are made to match. The file has no wrong choices, so a
 * question's stored choices are kept; only if a file answer isn't among them does
 * it replace one wrong choice (reported). Questions that aren't stored yet can't
 * be added from this file (it has no choices for them) and are reported. Stored
 * questions not in the file, and sample questions, are never touched. Previous
 * contents are saved next to the file first so a run can be undone; past test
 * results are unaffected (each attempt keeps its own frozen copy).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { normaliseText } from "@/lib/import/parseReorderJson";
import { applyAnswer, fibMainFileSchema, mapFibMainFile, type StoredBlank } from "@/lib/import/parseFibMainJson";

import { organizations, questions } from "./schema";
import { sslFor } from "./ssl";

const ORG_SLUG = "kalindri";

interface StoredPayload {
  passage_with_blanks: string;
  blanks: StoredBlank[];
  note?: string;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "dry-run": { type: "boolean", default: false }, skip: { type: "string", multiple: true, default: [] } },
  });
  const filePath = positionals[0] ?? "import-data/fib-rw-main.json";
  const skip = new Set((values.skip ?? []).map((title) => title.toLowerCase()));

  const parsedFile = fibMainFileSchema.safeParse(JSON.parse(readFileSync(filePath, "utf8")));
  if (!parsedFile.success) {
    throw new Error(`The file isn't in the expected shape:\n${parsedFile.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const { questions: wanted, problems } = mapFibMainFile(parsedFile.data);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - #${p.id} "${p.title}": ${p.errors.join(" ")}`);
    throw new Error(`${problems.length} question(s) have problems. Fix the file and re-run — nothing was changed.`);
  }
  console.log(`File: ${wanted.length} valid questions.`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.local).");
  const client = postgres(databaseUrl, { prepare: false, max: 1, ssl: sslFor(databaseUrl) });
  const db = drizzle(client);

  try {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, ORG_SLUG)).limit(1);
    if (!org) throw new Error(`No organization "${ORG_SLUG}".`);

    const stored = await db
      .select({ id: questions.id, externalId: questions.externalId, sourceNotes: questions.sourceNotes, difficulty: questions.difficulty, payload: questions.payload })
      .from(questions)
      .where(and(eq(questions.orgId, org.id), eq(questions.type, "FIB_RW"), eq(questions.isSeedData, false), like(questions.externalId, "FIB-RW-INST-%")));
    const storedTitle = (row: (typeof stored)[number]) => (row.sourceNotes ?? "").replace(/^Title: /, "").trim();

    const updates: { row: (typeof stored)[number]; payload: StoredPayload; difficulty: "easy" | "medium" | "hard" | null; title: string; what: string[] }[] = [];
    const missing: string[] = [];
    const held: string[] = [];
    const matched = new Set<string>();

    for (const item of wanted) {
      const row = stored.find((r) => storedTitle(r).toLowerCase() === item.title.toLowerCase());
      if (!row) {
        missing.push(item.title);
        continue;
      }
      matched.add(row.id);
      if (skip.has(item.title.toLowerCase())) {
        held.push(item.title);
        continue;
      }
      const payload = row.payload as StoredPayload;
      const blanks = [...payload.blanks].sort((a, b) => a.index - b.index);
      if (blanks.length !== item.answers.length) throw new Error(`"${item.title}": ${blanks.length} stored blanks but ${item.answers.length} answers in the file — nothing was changed.`);

      const what: string[] = [];
      let nextPassage = payload.passage_with_blanks;
      if (normaliseText(payload.passage_with_blanks) !== normaliseText(item.passage)) {
        nextPassage = item.passage;
        what.push("passage text");
      }
      const nextBlanks = blanks.map((blank, i) => {
        const answer = item.answers[i] ?? blank.correct_option;
        if (blank.correct_option === answer) return blank;
        const { blank: updated, replacedOption } = applyAnswer(blank, answer);
        what.push(`blank ${blank.index}: "${blank.correct_option}" → "${answer}"${replacedOption ? ` (not an offered choice; replaced wrong choice "${replacedOption}")` : ""}`);
        return updated;
      });
      if (item.difficulty && row.difficulty !== item.difficulty) what.push(`difficulty ${row.difficulty ?? "none"} → ${item.difficulty}`);
      if (storedTitle(row) !== item.title) what.push(`title "${storedTitle(row)}" → "${item.title}"`);
      if (what.length > 0) updates.push({ row, payload: { ...payload, passage_with_blanks: nextPassage, blanks: nextBlanks }, difficulty: item.difficulty, title: item.title, what });
    }

    console.log(`\nTo update (${updates.length}):`);
    for (const u of updates) console.log(`  ${u.row.externalId} "${u.title}": ${u.what.join("; ")}`);
    if (held.length > 0) console.log(`Held back by --skip: ${held.join(", ")}`);
    if (missing.length > 0) console.log(`In the file but not stored (can't be added — the file has no choices for them): ${missing.join(", ")}`);
    console.log(`Stored but not in the file (left as they are): ${stored.filter((r) => !matched.has(r.id)).map((r) => `${r.externalId} "${storedTitle(r)}"`).join(", ") || "—"}`);

    if (values["dry-run"]) {
      console.log("\nDry run: nothing written.");
      return;
    }
    if (updates.length === 0) {
      console.log("\nAlready in sync. Nothing to do.");
      return;
    }

    const backupPath = `import-data/fib-main-sync-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(backupPath, JSON.stringify(updates.map((u) => ({ id: u.row.id, externalId: u.row.externalId, difficulty: u.row.difficulty, sourceNotes: u.row.sourceNotes, payload: u.row.payload })), null, 2));
    console.log(`\nBackup of the ${updates.length} questions about to change: ${backupPath}`);

    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx
          .update(questions)
          .set({ payload: u.payload, ...(u.difficulty ? { difficulty: u.difficulty } : {}), sourceNotes: `Title: ${u.title}` })
          .where(eq(questions.id, u.row.id));
      }
    });
    console.log(`Done: ${updates.length} updated.`);
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
