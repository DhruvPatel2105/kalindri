import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordHeartbeat } from "@/lib/activity/record";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/sessionToken";
import { createClient } from "@/lib/supabase/server";

/**
 * Receives the activity heartbeat. A route handler rather than a Server
 * Action on purpose: Server Actions from one page run one at a time, so a
 * heartbeat would queue behind a student's answer saves; this runs on its own.
 *
 * Cheap on purpose (it is the most frequent request in the app): the login
 * token is verified locally (no network, no database), and the whole access
 * check — user exists and is active, this browser holds the CURRENT session
 * token — happens inside the single SQL statement that records the time. So
 * a heartbeat is ONE database query, not the three that a full page-style
 * session check plus the write would be. The student comes from the verified
 * login token, never from the request body — the body only says which page
 * they are on, which just picks a label.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const sessionToken = (await cookies()).get(SESSION_TOKEN_COOKIE)?.value;
  if (!userId || !sessionToken) return new NextResponse(null, { status: 401 });

  let path = "/";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "path" in body && typeof body.path === "string") {
      path = body.path.slice(0, 300);
    }
  } catch {
    // no/invalid body: still a valid heartbeat, filed under "other"
  }

  try {
    await recordHeartbeat(userId, sessionToken, path);
  } catch {
    // Tracking must never break the app; the next heartbeat just credits the gap if it is short enough.
  }
  return new NextResponse(null, { status: 204 });
}
