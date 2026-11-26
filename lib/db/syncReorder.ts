/**
 * Makes the stored Reorder Paragraph questions match the answer file.
 *
 * Run with:
 *   npm run sync-reorder -- [file] [--dry-run]
 *
 * file defaults to import-data/reorder-answers.json (git-ignored). THE FILE WINS:
 *   - a stored question with the same title (a trailing "(B)" is ignored) gets the
 *     file's paragraph order, difficulty and title, whatever it held before;
 *   - a question in the file that isn't stored yet is added (published);
 *   - a stored question that isn't in the file is left exactly as it is.
 * Sample (seed) questions are never touched. Before anything changes, the
 * affected questions' previous contents are saved next to the file so a run can
 * be undone. Past test results are unaffected: each attempt keeps its own frozen
 * copy of the question. Re-running changes nothing once the database matches.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { mapReorderFile, normaliseText, reorderFileSchema, titleKey } from "@/lib/import/parseReorderJson";

import { organizations, questions } from "./schema";
import { sslFor } from "./ssl";

const ORG_SLUG = "kalindri";
const READING_PART = 2; // lib/questions/types.ts PART_BY_TYPE
const ID_PREFIX = "REORDER-INST-";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "dry-run": { type: "boolean", default: false } },
  });
  const filePath = positionals[0] ?? "import-data/reorder-answers.json";

  const parsedFile = reorderFileSchema.safeParse(JSON.parse(readFileSync(filePath, "utf8")));
  if (!parsedFile.success) {
    throw new Error(`The file isn't in the expected shape:\n${parsedFile.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const { questions: wanted, problems } = mapReorderFile(parsedFile.data);
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
      .select({
        id: questions.id,
        externalId: questions.externalId,
        sourceNotes: questions.sourceNotes,
        difficulty: questions.difficulty,
        payload: questions.payload,
      })
      .from(questions)
      .where(and(eq(questions.orgId, org.id), eq(questions.type, "REORDER_PARAGRAPH"), eq(questions.isSeedData, false)));
    const storedTitle = (row: (typeof stored)[number]) => (row.sourceNotes ?? "").replace(/^Title: /, "").trim();

    let nextNumber = stored.reduce((max, row) => {
      const n = row.externalId?.startsWith(ID_PREFIX) ? Number(row.externalId.slice(ID_PREFIX.length)) : 0;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);

    const updates: { row: (typeof stored)[number]; boxes: string[]; difficulty: "easy" | "medium" | "hard" | null; title: string; what: string[] }[] = [];
    const inserts: (typeof wanted)[number][] = [];
    const matched = new Set<string>();

    for (const item of wanted) {
      const row = stored.find((r) => titleKey(storedTitle(r)) === titleKey(item.title));
      if (!row) {
        inserts.push(item);
        continue;
      }
      matched.add(row.id);
      const current = (row.payload as { boxes: string[] }).boxes;
      const what: string[] = [];
      const sameOrder = current.length === item.boxes.length && current.every((box, i) => normaliseText(box) === normaliseText(item.boxes[i] ?? ""));
      if (!sameOrder) what.push("paragraph order/text");
      if (item.difficulty && row.difficulty !== item.difficulty) what.push(`difficulty ${row.difficulty ?? "none"} → ${item.difficulty}`);
      if (storedTitle(row) !== item.title) what.push(`title "${storedTitle(row)}" → "${item.title}"`);
      if (what.length > 0) updates.push({ row, boxes: item.boxes, difficulty: item.difficulty, title: item.title, what });
    }

    console.log(`\nTo update (${updates.length}):`);
    for (const u of updates) console.log(`  ${u.row.externalId} "${u.title}": ${u.what.join("; ")}`);
    console.log(`To add (${inserts.length}): ${inserts.map((i) => `"${i.title}"`).join(", ") || "—"}`);
    const untouched = stored.filter((r) => !matched.has(r.id));
    console.log(`Stored but not in the file (left as they are): ${untouched.map((r) => `${r.externalId} "${storedTitle(r)}"`).join(", ") || "—"}`);

    if (values["dry-run"]) {
      console.log("\nDry run: nothing written.");
      return;
    }
    if (updates.length === 0 && inserts.length === 0) {
      console.log("\nAlready in sync. Nothing to do.");
      return;
    }

    const backupPath = `import-data/reorder-sync-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(
      backupPath,
      JSON.stringify(updates.map((u) => ({ id: u.row.id, externalId: u.row.externalId, difficulty: u.row.difficulty, sourceNotes: u.row.sourceNotes, payload: u.row.payload })), null, 2),
    );
    console.log(`\nBackup of the ${updates.length} questions about to change: ${backupPath}`);

    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx
          .update(questions)
          .set({
            payload: { ...(u.row.payload as object), boxes: u.boxes },
            ...(u.difficulty ? { difficulty: u.difficulty } : {}),
            sourceNotes: `Title: ${u.title}`,
          })
          .where(eq(questions.id, u.row.id));
      }
      for (const item of inserts) {
        nextNumber += 1;
        await tx.insert(questions).values({
          orgId: org.id,
          externalId: `${ID_PREFIX}${String(nextNumber).padStart(3, "0")}`,
          type: "REORDER_PARAGRAPH",
          part: READING_PART,
          payload: { boxes: item.boxes },
          difficulty: item.difficulty,
          status: "published",
          isActive: true,
          source: "institute",
          sourceNotes: `Title: ${item.title}`,
          isSeedData: false,
        });
      }
    });
    console.log(`Done: ${updates.length} updated, ${inserts.length} added.`);
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
