import "server-only";

import { getDb } from "@/lib/db";

import { computeMastery } from "./mastery";
import { getMasteryAttempts } from "./listMastery";

/** A student's question mastery, overall and per type, from their saved attempts. */
export async function loadMastery(userId: string) {
  return computeMastery(await getMasteryAttempts(getDb(), { userId }));
}
