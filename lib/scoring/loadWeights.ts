import "server-only";

import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb } from "@/lib/db";
import { skillWeights } from "@/lib/db/schema";

import { DERIVED_SOURCE, type WeightRow } from "./derivedWeights";

export interface LoadedWeights {
  rows: WeightRow[];
  /** How the weights were derived, from the table's own `method_note` (null if there are none). */
  methodNote: string | null;
}

/** The active derived weights from the `skill_weights` table (cached briefly: they change rarely). */
export const loadWeights = unstable_cache(
  async (orgId: string): Promise<LoadedWeights> => {
    const rows = await getDb()
      .select({
        questionType: skillWeights.questionType,
        skill: skillWeights.skill,
        weightPct: skillWeights.weightPct,
        methodNote: skillWeights.methodNote,
      })
      .from(skillWeights)
      .where(
        and(
          eq(skillWeights.orgId, orgId),
          eq(skillWeights.isActive, true),
          eq(skillWeights.source, DERIVED_SOURCE),
        ),
      );
    return {
      rows: rows.map((row) => ({
        questionType: row.questionType,
        skill: row.skill,
        weightPct: Number(row.weightPct),
      })),
      methodNote: rows.find((row) => row.methodNote)?.methodNote ?? null,
    };
  },
  ["skill-weights"],
  { revalidate: 600, tags: ["skill-weights"] },
);
