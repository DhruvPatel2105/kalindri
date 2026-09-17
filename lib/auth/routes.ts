/**
 * Route protection — which paths require an authenticated session.
 *
 * Pure and framework-agnostic on purpose: `middleware.ts` is hard to exercise
 * in a unit test (it needs a real `NextRequest`/`NextResponse` and a Supabase
 * session), so the actual "public vs protected" decision lives here where it
 * can be tested directly, and middleware.ts just calls it.
 *
 * Policy: every path requires an authenticated session EXCEPT `/login` and
 * Next.js internals. No public dashboard, no other exceptions. (Static
 * assets under `/_next/*` are also excluded by middleware's `matcher` config
 * so middleware never runs on them at all — the check here is a second,
 * independently-testable line of defense, not the only one.)
 */

const PUBLIC_PATHS: readonly string[] = ["/login"];

function isNextInternalPath(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico";
}

/** True if `pathname` may be visited without an authenticated session. */
export function isPublicPath(pathname: string): boolean {
  if (isNextInternalPath(pathname)) return true;
  return PUBLIC_PATHS.includes(pathname);
}

/** True if `pathname` requires an authenticated session. */
export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}
