/**
 * Seed script — inserts the single launch organization and nothing else.
 *
 * Run with:  npm run db:seed   (loads .env.local if present)
 * Idempotent: re-running does not create a duplicate organization.
 *
 * Standalone on purpose: it opens its own connection rather than importing the
 * app's `lib/db` client (which is marked `server-only` and won't load outside
 * the Next.js server runtime).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { organizations } from "./schema";

const ORG_NAME = "Kalindri";
const ORG_SLUG = "kalindri";

async function main(): Promise<void> {
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
      .insert(organizations)
      .values({ name: ORG_NAME, slug: ORG_SLUG, isActive: true })
      .onConflictDoNothing({ target: organizations.slug })
      .returning();

    if (org) {
      console.log(`Inserted organization "${org.name}" (${org.id}).`);
    } else {
      console.log(`Organization "${ORG_SLUG}" already exists — nothing to do.`);
    }
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
