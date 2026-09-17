import { randomInt } from "node:crypto";

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";
const ALL_CHARS = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;

const PASSWORD_LENGTH = 16; // >= 12 required

function randomChar(pool: string): string {
  return pool.charAt(randomInt(pool.length));
}

/** Random order via crypto-random sort keys — sidesteps index-swap juggling entirely. */
function shuffle(chars: readonly string[]): string[] {
  return chars
    .map((char) => ({ char, sortKey: randomInt(1_000_000) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.char);
}

/**
 * A cryptographically random password for a newly-created account — at
 * least 12 characters (16 here), guaranteed to include at least one
 * lowercase, uppercase, digit and symbol character (one of each is picked
 * first, the rest filled randomly, then the whole thing shuffled). Uses
 * node:crypto's `randomInt` (rejection-sampled, uniform), never
 * `Math.random` — which is not cryptographically secure.
 */
export function generatePassword(): string {
  const guaranteed = [
    randomChar(LOWERCASE),
    randomChar(UPPERCASE),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];

  const rest = Array.from(
    { length: PASSWORD_LENGTH - guaranteed.length },
    () => randomChar(ALL_CHARS),
  );

  return shuffle([...guaranteed, ...rest]).join("");
}
