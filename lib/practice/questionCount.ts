/**
 * Choosing how many questions of a set to sit as a test. Pure.
 */

/**
 * `?count=` read as a positive whole number, or undefined (meaning the whole
 * set) for anything missing, malformed or below 1. Capping at the set's size
 * is done where the questions are known (`clampCount`).
 */
export function parseCountParam(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const count = Number(value);
  return count >= 1 && Number.isSafeInteger(count) ? count : undefined;
}

/** A requested count held to 1..available; undefined or invalid means all of them. */
export function clampCount(requested: number | undefined, available: number): number {
  if (available <= 0) return 0;
  if (requested === undefined || !Number.isInteger(requested) || requested < 1) return available;
  return Math.min(requested, available);
}

/**
 * Picks `count` of `ids` at random (no repeats) and returns them in their
 * ORIGINAL order, so a shorter test keeps the set's own sequence. Asking for
 * all of them (or more) returns every id untouched. `random` is injectable
 * for tests.
 */
export function pickQuestionIds(
  ids: readonly string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const wanted = clampCount(count, ids.length);
  if (wanted >= ids.length) return [...ids];

  // Partial Fisher–Yates over the indexes, then restore the original order.
  const indexes = ids.map((_, i) => i);
  for (let i = 0; i < wanted; i++) {
    const j = i + Math.floor(random() * (indexes.length - i));
    const a = indexes[i];
    const b = indexes[j];
    if (a === undefined || b === undefined) continue;
    indexes[i] = b;
    indexes[j] = a;
  }
  return indexes
    .slice(0, wanted)
    .sort((x, y) => x - y)
    .flatMap((i) => {
      const id = ids[i];
      return id === undefined ? [] : [id];
    });
}
