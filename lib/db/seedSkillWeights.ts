/**
 * Seeds the `skill_weights` table with the DERIVED cross-skill weight model
 * (docs/02-scoring-spec.md §10; source 'derived_v1'). Weights live in the
 * database, never in app code, so they can be corrected without a release.
 *
 * Run with:  npm run db:seed:weights
 *
 * Idempotent: if the organization already has derived_v1 rows it does nothing
 * (it never overwrites or duplicates). A corrected model should be added as a
 * new source (e.g. 'derived_v2') and the old rows set inactive.
 *
 * Standalone like the other db scripts: opens its own connection.
 */

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  DERIVED_METHOD_NOTE,
  DERIVED_SOURCE,
  DERIVED_WEIGHT_ROWS,
} from "@/lib/scoring/derivedWeights";

import { organizations, skillWeights } from "./schema";

const ORG_SLUG = "kalindri"; // must match lib/db/seed.ts's ORG_SLUG

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.local).");

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);
  try {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);
    if (!org) throw new Error(`No organization "${ORG_SLUG}". Run "npm run db:seed" first.`);

    const existing = await db
      .select({ id: skillWeights.id })
      .from(skillWeights)
      .where(and(eq(skillWeights.orgId, org.id), eq(skillWeights.source, DERIVED_SOURCE)));
    if (existing.length > 0) {
      console.log(`Already seeded: ${existing.length} ${DERIVED_SOURCE} rows. Nothing to do.`);
      return;
    }

    await db.insert(skillWeights).values(
      DERIVED_WEIGHT_ROWS.map((row) => ({
        orgId: org.id,
        questionType: row.questionType,
        skill: row.skill,
        weightPct: String(row.weightPct),
        source: DERIVED_SOURCE,
        methodNote: DERIVED_METHOD_NOTE,
        isActive: true,
      })),
    );
    console.log(`Seeded ${DERIVED_WEIGHT_ROWS.length} ${DERIVED_SOURCE} weight rows.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
