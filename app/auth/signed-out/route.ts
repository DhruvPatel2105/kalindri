import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/sessionToken";
import { createClient } from "@/lib/supabase/server";

/**
 * The only place that actually clears cookies for a "signed in elsewhere"
 * sign-out. Next.js forbids cookie mutation during a Server Component's
 * render — only a Server Action (form submission) or a Route Handler may do
 * it — and requireActiveSession() detects staleness mid-render, so it
 * redirects here instead of mutating cookies itself. A GET Route Handler,
 * not a Server Action, because this is reached via a plain redirect, not a
 * user-initiated form submission.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(
    new URL("/login?reason=signed-in-elsewhere", request.url),
  );
  response.cookies.delete(SESSION_TOKEN_COOKIE);
  return response;
}
