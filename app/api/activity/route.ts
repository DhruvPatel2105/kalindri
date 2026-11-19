import { NextResponse } from "next/server";

import { recordHeartbeat } from "@/lib/activity/record";
import { requireActiveSession } from "@/lib/auth/requireActiveSession";

/**
 * Receives the activity heartbeat. A route handler rather than a Server
 * Action on purpose: Server Actions from one page run one at a time, so a
 * heartbeat would queue behind a student's answer saves; this runs on its own.
 *
 * Authenticated like every other page (requireActiveSession); the student
 * and organisation come from that session, never from the request body — the
 * body only says which page they're on, which just picks a label.
 */
export async function POST(request: Request) {
  const user = await requireActiveSession();

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
    await recordHeartbeat({ id: user.id, orgId: user.orgId }, path);
  } catch {
    // Tracking must never break the app; the next heartbeat just credits the gap if it is short enough.
  }
  return new NextResponse(null, { status: 204 });
}
