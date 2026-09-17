/**
 * The application's own session-token cookie — separate from Supabase's auth
 * cookies. `active_sessions.session_token` is compared against this cookie
 * to enforce single-active-session (session 7A).
 */

export const SESSION_TOKEN_COOKIE = "kalindri_session";

/** A cryptographically random, unguessable session token. */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}
