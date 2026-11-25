/**
 * Groups existing published questions into question SETS — the unit a student
 * browses and sits as one practice test.
 *
 * Run with:
 *   npm run create-sets -- --type <QUESTION_TYPE> [--size 15] [--difficulty easy|medium|hard]
 *                          [--full-sets-only] [--publish] [--dry-run]
 *
 *   --type            one of the Reading types (REORDER_PARAGRAPH, FIB_READING,
 *                     FIB_RW, MCS_READING, MCM_READING)
 *   --size            questions per set (default 15, max 50)
 *   --difficulty      only group questions already rated this; the set gets the
 *                     same rating. Without it, every question is grouped and
 *                     the set is left unrated.
 *   --full-sets-only  don't make a short last set; those questions wait for
 *                     the next run
 *   --publish         students can see the sets (default: draft)
 *   --dry-run         print the plan, write nothing (no database writes)
 *
 * Only published, active questions that are NOT already in a set of this type
 * are used, oldest first, so re-running after importing more questions makes
 * new sets without touching existing ones. Questions are never modified.
 *
 * Standalone like the other db scripts: opens its own connection (lib/db is
 * server-only).
 */

import { parseArgs } from "node:util";

import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { parseSetSize, planSets } from "@/lib/practice/buildSets";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { PRACTISABLE_TYPES } from "@/lib/questions/practisable";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { organizations, questions, questionSets } from "./schema";
import { sslFor } from "./ssl";

const ORG_SLUG = "kalindri"; // must match lib/db/seed.ts's ORG_SLUG
const SETTABLE: readonly QuestionType[] = PRACTISABLE_TYPES;

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      type: { type: "string" },
      size: { type: "string" },
      difficulty: { type: "string" },
      "full-sets-only": { type: "boolean", default: false },
      publish: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const type = values.type as QuestionType | undefined;
  if (!type || !(QUESTION_TYPES as readonly string[]).includes(type)) {
    throw new Error(`--type is required: one of ${SETTABLE.join(", ")}`);
  }
  if (!SETTABLE.includes(type)) {
    throw new Error(`${type} has no practice-test UI yet. Use one of ${SETTABLE.join(", ")}.`);
  }
  const difficulty = values.difficulty as (typeof DIFFICULTIES)[number] | undefined;
  if (difficulty && !DIFFICULTIES.includes(difficulty)) {
    throw new Error(`--difficulty must be one of ${DIFFICULTIES.join(", ")}.`);
  }
  const size = parseSetSize(values.size);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.local).");

  const client = postgres(databaseUrl, { prepare: false, max: 1, ssl: sslFor(databaseUrl) });
  const db = drizzle(client);

  try {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);
    if (!org) throw new Error(`No organization "${ORG_SLUG}". Run "npm run db:seed" first.`);

    const existingSets = await db
      .select({ questionIds: questionSets.questionIds })
      .from(questionSets)
      .where(
        and(
          eq(questionSets.orgId, org.id),
          eq(questionSets.type, type),
          // the hidden Mixed-test bank set lists every question; it isn't a grouping
          eq(questionSets.isBank, false),
        ),
      );
    const grouped = new Set(existingSets.flatMap((s) => s.questionIds));

    const candidates = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.orgId, org.id),
          eq(questions.type, type),
          eq(questions.status, "published"),
          eq(questions.isActive, true),
          ...(difficulty ? [eq(questions.difficulty, difficulty)] : []),
        ),
      )
      .orderBy(asc(questions.createdAt), asc(questions.id));

    const ungrouped = candidates.filter((q) => !grouped.has(q.id)).map((q) => q.id);
    const { sets, leftover } = planSets(ungrouped, size, {
      startNumber: existingSets.length + 1,
      fullSetsOnly: values["full-sets-only"],
    });

    const label = QUESTION_TYPE_LABELS[type];
    console.log(
      `${type}: ${candidates.length} published question(s), ${grouped.size} already in a set, ${ungrouped.length} to group.`,
    );
    for (const set of sets) {
      console.log(`  ${label} — Set ${set.number}: ${set.questionIds.length} question(s)`);
    }
    if (leftover.length > 0) {
      console.log(`  (${leftover.length} left over for a later run, --full-sets-only)`);
    }

    if (sets.length === 0) {
      console.log("Nothing to create.");
      return;
    }
    if (values["dry-run"]) {
      console.log("Dry run — nothing written.");
      return;
    }

    await db.insert(questionSets).values(
      sets.map((set) => ({
        orgId: org.id,
        type,
        title: `${label} — Set ${set.number}`,
        difficulty: difficulty ?? null,
        questionIds: set.questionIds,
        status: values.publish ? ("published" as const) : ("draft" as const),
      })),
    );
    console.log(
      `Created ${sets.length} set(s) as ${values.publish ? "PUBLISHED" : "DRAFT (re-run with --publish, or publish them in SQL, so students can see them)"}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
