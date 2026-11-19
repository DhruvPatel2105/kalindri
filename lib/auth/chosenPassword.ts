/**
 * Rules for a password an admin types when creating an account (instead of
 * the generated one). Pure, so the same check can run in the form and, as the
 * real gate, in the server action.
 *
 * 8 characters minimum; 72 maximum because the password hashing Supabase uses
 * (bcrypt) ignores anything beyond 72 bytes. A password made only of one
 * repeated character is refused as trivially guessable. Whitespace at the
 * ends is refused rather than silently trimmed, so what the admin typed is
 * exactly what the student must type.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Null if the password is acceptable, otherwise a message for the admin. */
export function chosenPasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (password !== password.trim()) {
    return "Password can't start or end with a space.";
  }
  if (new Set(password).size === 1) {
    return "Password can't be a single repeated character.";
  }
  return null;
}
