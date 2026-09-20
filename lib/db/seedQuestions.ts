/**
 * Seed script — inserts 3 original MCS_READING practice questions.
 * Separate from lib/db/seed.ts (which only seeds the organization) —
 * deliberately not conflated with it.
 *
 * Run with:  npm run db:seed:questions   (loads .env.local if present)
 * Idempotent: checks each question's external_id before inserting, so
 * re-running never creates duplicates.
 *
 * Standalone, same as lib/db/seed.ts and lib/db/create-admin.ts: opens its
 * own connection rather than importing lib/db (server-only, won't load
 * outside the Next.js server runtime).
 *
 * CLAUDE.md: original Canadian everyday/workplace content only — never
 * anything resembling Pearson's real exam material, including anything in
 * design/reference/. Every payload below is validated against the real
 * mcsReadingSchema (lib/questions/schemas/mcs-reading.ts) before insert —
 * its shape isn't guessed.
 */

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { mcsReadingSchema } from "@/lib/questions/schemas/mcs-reading";

import { organizations, questions } from "./schema";

const ORG_SLUG = "kalindri"; // must match lib/db/seed.ts's ORG_SLUG

interface SeedQuestion {
  externalId: string;
  payload: {
    passage: string;
    question: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
  };
}

const SEED_QUESTIONS: SeedQuestion[] = [
  {
    externalId: "MCS-READING-SEED-1",
    payload: {
      passage:
        "Maple Ridge Consulting recently updated its remote work policy. " +
        "Employees may now work from home up to three days per week, " +
        "provided they attend all scheduled team meetings in person on " +
        "Tuesdays. Staff who wish to work remotely full-time must submit a " +
        "written request to their manager for approval on a case-by-case " +
        "basis. The policy takes effect at the start of the next fiscal " +
        "quarter.",
      question:
        "According to the passage, on which day must employees attend team meetings in person?",
      options: [
        { id: "a", text: "Monday" },
        { id: "b", text: "Tuesday" },
        { id: "c", text: "Wednesday" },
        { id: "d", text: "Friday" },
      ],
      correct_option_id: "b",
    },
  },
  {
    externalId: "MCS-READING-SEED-2",
    payload: {
      passage:
        "The City of Riverbend is changing its curbside recycling schedule " +
        "starting in September. Blue bins for paper and cardboard will be " +
        "collected every second Monday, while green bins for glass and " +
        "plastic will be collected every second Thursday. Residents are " +
        "reminded to place bins at the curb by 7 a.m. on collection day, as " +
        "trucks will not return for missed pickups until the following " +
        "cycle.",
      question:
        "What should residents do if they miss the collection time for their bin?",
      options: [
        { id: "a", text: "Call the city for a special pickup" },
        { id: "b", text: "Wait until the next scheduled collection day" },
        { id: "c", text: "Leave the bin out until it is collected" },
        { id: "d", text: "Take the bin to a recycling depot themselves" },
      ],
      correct_option_id: "b",
    },
  },
  {
    externalId: "MCS-READING-SEED-3",
    payload: {
      passage:
        "Northline Transit has announced a temporary detour on Route 12 due " +
        "to bridge maintenance on Elm Street. Starting Monday, buses will " +
        "travel via King Street and Oak Avenue instead of their usual path, " +
        "adding approximately eight minutes to the trip. The detour is " +
        "expected to remain in place for six weeks. Riders are advised to " +
        "check the transit app for updated arrival times during this " +
        "period.",
      question: "Why is Route 12 being temporarily rerouted?",
      options: [
        { id: "a", text: "A transit strike" },
        { id: "b", text: "Low ridership" },
        { id: "c", text: "Bridge maintenance" },
        { id: "d", text: "A new bus terminal opening" },
      ],
      correct_option_id: "c",
    },
  },
];

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
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);
    if (!org) {
      throw new Error(
        `No organization found with slug "${ORG_SLUG}". Run "npm run db:seed" first.`,
      );
    }

    let inserted = 0;
    let skipped = 0;

    for (const seedQuestion of SEED_QUESTIONS) {
      // Validate against the real payload schema before inserting.
      const payload = mcsReadingSchema.parse(seedQuestion.payload);

      const [existing] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.orgId, org.id),
            eq(questions.externalId, seedQuestion.externalId),
          ),
        )
        .limit(1);

      if (existing) {
        console.log(
          `Skipping "${seedQuestion.externalId}" — already seeded.`,
        );
        skipped++;
        continue;
      }

      await db.insert(questions).values({
        orgId: org.id,
        externalId: seedQuestion.externalId,
        type: "MCS_READING",
        part: 2,
        payload,
        status: "published",
        isActive: true,
        source: "seed",
        isSeedData: true,
      });

      console.log(`Inserted "${seedQuestion.externalId}".`);
      inserted++;
    }

    console.log(`Done: ${inserted} inserted, ${skipped} already present.`);
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
