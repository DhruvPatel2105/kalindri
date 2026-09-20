/**
 * Seed script — inserts original practice questions: 3 MCS_READING, then 3
 * MCM_READING. Separate from lib/db/seed.ts (which only seeds the
 * organization) — deliberately not conflated with it.
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
 * per-type schema (lib/questions/schemas/) before insert — shapes aren't
 * guessed.
 */

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { mcmReadingSchema } from "@/lib/questions/schemas/mcm-reading";
import { mcsReadingSchema } from "@/lib/questions/schemas/mcs-reading";

import { organizations, questions } from "./schema";

const ORG_SLUG = "kalindri"; // must match lib/db/seed.ts's ORG_SLUG
const READING_PART = 2; // lib/questions/types.ts PART_BY_TYPE

interface McsSeedItem {
  externalId: string;
  type: "MCS_READING";
  payload: {
    passage: string;
    question: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
  };
}

interface McmSeedItem {
  externalId: string;
  type: "MCM_READING";
  payload: {
    passage: string;
    question: string;
    options: { id: string; text: string }[];
    correct_option_ids: string[];
  };
}

type SeedItem = McsSeedItem | McmSeedItem;

const SEED_ITEMS: SeedItem[] = [
  {
    externalId: "MCS-READING-SEED-1",
    type: "MCS_READING",
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
    type: "MCS_READING",
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
    type: "MCS_READING",
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
  {
    externalId: "MCM-READING-SEED-1",
    type: "MCM_READING",
    payload: {
      passage:
        "Several municipal offices across the province have introduced " +
        "voluntary ergonomics assessments for employees who spend most of " +
        "the day at a desk. Staff can request a one-time review of their " +
        "workstation setup, including chair height, monitor position, and " +
        "keyboard placement. Early results from a pilot program showed a " +
        "reduction in reported wrist and back strain among participants. " +
        "The assessments are conducted by a trained occupational health " +
        "consultant and typically take under an hour. Employees who " +
        "complete an assessment are also given a written summary of any " +
        "recommended equipment changes, though approval for purchasing new " +
        "equipment still requires manager sign-off.",
      question:
        "According to the passage, which of the following are true about the ergonomics assessments? (Select all that apply.)",
      options: [
        { id: "a", text: "They are mandatory for all desk-based employees" },
        {
          id: "b",
          text: "They are conducted by a trained occupational health consultant",
        },
        {
          id: "c",
          text: "Participants receive a written summary of recommendations",
        },
        { id: "d", text: "New equipment purchases are automatically approved" },
        { id: "e", text: "The pilot program showed reduced reports of strain" },
      ],
      correct_option_ids: ["b", "c", "e"],
    },
  },
  {
    externalId: "MCM-READING-SEED-2",
    type: "MCM_READING",
    payload: {
      passage:
        "The Parks and Recreation department is expanding its community " +
        "garden program to four additional neighbourhoods next spring. " +
        "Residents who wish to reserve a plot must submit an application by " +
        "February 1st and pay a refundable deposit, which is returned at " +
        "the end of the growing season if the plot is left in good " +
        "condition. Water access is provided free of charge at each site, " +
        "but gardeners are responsible for supplying their own tools and " +
        "seeds. The department has also announced that returning gardeners " +
        "from the previous year will be given priority placement over new " +
        "applicants.",
      question:
        "According to the passage, which of the following are true about the community garden program? (Select all that apply.)",
      options: [
        { id: "a", text: "Gardeners must supply their own tools and seeds" },
        { id: "b", text: "The deposit is non-refundable" },
        {
          id: "c",
          text: "Returning gardeners are given priority over new applicants",
        },
        { id: "d", text: "Water access is provided free of charge" },
        { id: "e", text: "Applications are accepted year-round" },
      ],
      correct_option_ids: ["a", "c", "d"],
    },
  },
  {
    externalId: "MCM-READING-SEED-3",
    type: "MCM_READING",
    payload: {
      passage:
        "A regional employers' association has launched a mentorship " +
        "program pairing newly licensed tradespeople with experienced " +
        "journeypersons. Mentors commit to meeting with their assigned " +
        "mentee at least twice a month for the first year. The program is " +
        "funded through employer contributions rather than government " +
        "grants, and participation is voluntary for both mentors and " +
        "mentees. An early survey of participants found that mentees in " +
        "the program were more likely to remain in their trade after three " +
        "years compared to those who did not participate. Mentors receive " +
        "a small stipend, but the association has stated this is intended " +
        "as a token of appreciation rather than compensation for their " +
        "time.",
      question:
        "According to the passage, which of the following are true about the mentorship program? (Select all that apply.)",
      options: [
        { id: "a", text: "The program is funded by government grants" },
        {
          id: "b",
          text: "Mentors are required to meet with mentees at least twice a month",
        },
        {
          id: "c",
          text: "Participation is mandatory for newly licensed tradespeople",
        },
        {
          id: "d",
          text: "Mentees in the program were more likely to remain in their trade",
        },
        { id: "e", text: "Mentors receive a stipend" },
      ],
      correct_option_ids: ["b", "d", "e"],
    },
  },
];

function validatePayload(item: SeedItem): unknown {
  return item.type === "MCS_READING"
    ? mcsReadingSchema.parse(item.payload)
    : mcmReadingSchema.parse(item.payload);
}

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

    for (const item of SEED_ITEMS) {
      // Validate against the real payload schema before inserting.
      const payload = validatePayload(item);

      const [existing] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.orgId, org.id),
            eq(questions.externalId, item.externalId),
          ),
        )
        .limit(1);

      if (existing) {
        console.log(`Skipping "${item.externalId}" — already seeded.`);
        skipped++;
        continue;
      }

      await db.insert(questions).values({
        orgId: org.id,
        externalId: item.externalId,
        type: item.type,
        part: READING_PART,
        payload,
        status: "published",
        isActive: true,
        source: "seed",
        isSeedData: true,
      });

      console.log(`Inserted "${item.externalId}".`);
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
