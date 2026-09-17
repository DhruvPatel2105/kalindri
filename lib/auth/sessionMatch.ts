/**
 * Pure comparison used by requireActiveSession() to decide whether this
 * browser's session-token cookie still matches the current active_sessions
 * row for the user. Extracted on its own because this decision — whether a
 * browser gets treated as "superseded elsewhere" and signed out — is exactly
 * the kind of thing worth testing exhaustively without a live DB or cookies.
 */
export function sessionMatches(
  cookieToken: string | undefined,
  storedToken: string | undefined,
): boolean {
  if (!cookieToken || !storedToken) return false;
  return cookieToken === storedToken;
}
