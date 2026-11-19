/**
 * Question rotation: one shared, pure mechanism that decides which questions
 * a "Mixed test" draws, for EVERY question type alike (the caller passes that
 * type's question bank and the student's history for it — nothing here knows
 * about a particular type).
 *
 * The rule: a student never sees a question again until they have answered
 * every question in the bank; then a new round starts and the whole bank is
 * available again.
 *
 *   - "Attempted" means ANSWERED in a submitted test. A question left blank is
 *     not attempted and stays available (the caller only feeds in answered
 *     attempts).
 *   - Questions inside a test the student has open (unfinished) are
 *     "reserved": not offered to a second test started at the same time.
 *   - History is read per test ("batch"), oldest first. When a test finishes
 *     the round — it contains the last unattempted questions, topped up with
 *     questions from the start of the next round if the student asked for
 *     more than were left — the round closes and the extras seed the new one.
 */

export interface RotationInput {
  /** Every question id in the bank right now (published, active, this type). */
  pool: readonly string[];
  /**
   * The student's answered attempts at this type's questions, grouped by test
   * (one array of question ids per test), oldest test first.
   */
  history: readonly (readonly string[])[];
  /** Question ids inside the student's unfinished tests of this type. */
  reserved: readonly string[];
  /** How many questions the student asked for. */
  count: number;
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
}

export interface RotationState {
  /** Questions attempted so far in the CURRENT round (a subset of the pool). */
  attempted: Set<string>;
  /** How many full rounds of the bank the student has completed. */
  roundsCompleted: number;
}

/**
 * Replays the history to find where the student is in the bank: which
 * questions they have answered in the current round, and how many rounds
 * they've finished. Ids no longer in the pool (a question was unpublished) are
 * ignored, so the bank can change without breaking anyone's history.
 */
export function currentRound(
  pool: readonly string[],
  history: readonly (readonly string[])[],
): RotationState {
  const inPool = new Set(pool);
  let attempted = new Set<string>();
  let roundsCompleted = 0;
  if (inPool.size === 0) return { attempted, roundsCompleted };

  for (const batch of history) {
    const ids = [...new Set(batch)].filter((id) => inPool.has(id));
    const fresh = ids.filter((id) => !attempted.has(id));
    const repeats = ids.filter((id) => attempted.has(id));
    for (const id of fresh) attempted.add(id);
    if (attempted.size >= inPool.size) {
      // This test finished the round. Anything in it that had already been
      // answered is a top-up from the start of the next round.
      roundsCompleted += 1;
      attempted = new Set(repeats);
    }
    // Otherwise a repeat inside a round changes nothing.
  }
  return { attempted, roundsCompleted };
}

/** How many questions of the pool are still unattempted in the current round. */
export function remainingInRound(
  pool: readonly string[],
  history: readonly (readonly string[])[],
): number {
  const { attempted } = currentRound(pool, history);
  return pool.filter((id) => !attempted.has(id)).length;
}

/** `count` items drawn at random without repeats; the pool order is kept in the result. */
function sample(items: readonly string[], count: number, random: () => number): string[] {
  if (count >= items.length) return [...items];
  const indexes = items.map((_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (indexes.length - i));
    const a = indexes[i];
    const b = indexes[j];
    if (a === undefined || b === undefined) continue;
    indexes[i] = b;
    indexes[j] = a;
  }
  return indexes
    .slice(0, count)
    .sort((x, y) => x - y)
    .flatMap((i) => {
      const id = items[i];
      return id === undefined ? [] : [id];
    });
}

/**
 * The question ids for the student's next mixed test, in bank order.
 *
 * Draws from the questions not yet attempted this round (and not reserved by
 * another open test). If fewer than `count` remain, it takes them all and,
 * when that completes the round, tops up from the bank's start-of-next-round;
 * if the shortfall is only because other tests have some reserved, it returns
 * just what is available rather than repeating anything early.
 */
export function selectRotation({ pool, history, reserved, count, random = Math.random }: RotationInput): string[] {
  const wanted = Math.min(Math.max(0, Math.floor(count)), pool.length);
  if (wanted === 0) return [];

  const { attempted } = currentRound(pool, history);
  const blocked = new Set(reserved);
  const unattempted = pool.filter((id) => !attempted.has(id));
  const available = unattempted.filter((id) => !blocked.has(id));

  if (available.length >= wanted) return sample(available, wanted, random);

  // Not enough fresh questions. If some unattempted ones are only held back by
  // another open test, this test can't complete the round: give what's free.
  if (available.length < unattempted.length) return available;

  // This test takes every remaining question, finishing the round; top up with
  // questions from the new round, never one already chosen.
  const chosen = new Set(available);
  const topUp = pool.filter((id) => !chosen.has(id) && !blocked.has(id));
  const extra = sample(topUp, wanted - available.length, random);
  const all = new Set([...available, ...extra]);
  return pool.filter((id) => all.has(id));
}
