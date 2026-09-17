import "server-only";

/**
 * The single-active-session gate for every protected Server Component/page.
 *
 * Currently called only from app/page.tsx (session 7A's only protected
 * route). Any FUTURE protected page must call this same helper too — or,
 * once there's more than one protected route, this check should move into a
 * shared layout instead of being repeated per page.
 *
 * middleware.ts (unchanged from session 6, Edge runtime, no DB access) only
 * confirms a Supabase session exists. This adds the app-level "is this
 * browser's session still the CURRENT one for this user" check on top,
 * backed by `active_sessions` — which is exactly why it can't live in
 * middleware: the `postgres` driver needs Node's `net`/`tls`, unavailable on
 * Edge.
 */

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { activeSessions, users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

import { sessionMatches } from "./sessionMatch";
import { shouldRefreshLastSeen } from "./sessionFreshness";
import { SESSION_TOKEN_COOKIE } from "./sessionToken";

export async function requireActiveSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;

  const db = getDb();
  const [session] = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.userId, user.id))
    .limit(1);

  if (!session || !sessionMatches(cookieToken, session.sessionToken)) {
    // Superseded elsewhere (or no session cookie/row at all). A Server
    // Component can't mutate cookies itself — Next.js only allows that in a
    // Server Action or a Route Handler — and this runs mid-render, not in
    // response to a form submission. So redirect to a tiny Route Handler
    // that does the actual Supabase sign-out + cookie clear, then lands the
    // browser on /login?reason=signed-in-elsewhere.
    redirect("/auth/signed-out");
  }

  if (shouldRefreshLastSeen(session.lastSeenAt, new Date())) {
    await db
      .update(activeSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(activeSessions.userId, user.id));
  }

  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!appUser || !appUser.isActive) {
    redirect("/login");
  }

  return appUser;
}
