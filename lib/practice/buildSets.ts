/**
 * Pure planning for lib/db/createQuestionSets.ts: split a list of question ids
 * into numbered sets. No DB access.
 */

export const DEFAULT_SET_SIZE = 15;
export const MAX_SET_SIZE = 50;

export interface PlannedSet {
  /** 1-based, continuing from `startNumber` — used in the default title. */
  number: number;
  questionIds: string[];
}

/**
 * Chunks `ids` (kept in the order given) into sets of `size`. The last set
 * may be short; with `fullSetsOnly` it is left out instead and its ids are
 * returned in `leftover` so they're picked up by the next run.
 */
export function planSets(
  ids: readonly string[],
  size: number,
  options: { startNumber?: number; fullSetsOnly?: boolean } = {},
): { sets: PlannedSet[]; leftover: string[] } {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Set size must be a positive whole number, got ${size}.`);
  }
  const startNumber = options.startNumber ?? 1;

  const sets: PlannedSet[] = [];
  let leftover: string[] = [];

  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    if (chunk.length < size && options.fullSetsOnly) {
      leftover = chunk;
      break;
    }
    sets.push({ number: startNumber + sets.length, questionIds: chunk });
  }

  return { sets, leftover };
}

/** Parses `--size`; undefined means the default. Rejects junk instead of guessing. */
export function parseSetSize(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SET_SIZE;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`--size must be a whole number, got "${raw}".`);
  }
  const size = Number(raw);
  if (size < 1 || size > MAX_SET_SIZE) {
    throw new Error(`--size must be between 1 and ${MAX_SET_SIZE}, got ${size}.`);
  }
  return size;
}
