import "server-only";

/**
 * Admin-only gate for everything under /admin — layered on top of
 * requireActiveSession() (session 7), not a reimplementation of it. Call
 * from app/admin/layout.tsx so every nested route is protected in one place.
 */

import { redirect } from "next/navigation";

import { isAdminRole } from "./isAdminRole";
import { requireActiveSession } from "./requireActiveSession";

export async function requireAdmin() {
  const appUser = await requireActiveSession();

  if (!isAdminRole(appUser.role)) {
    // Authenticated, just not authorized. /login would be wrong here — it
    // implies "you're not signed in", which isn't true for this user.
    redirect("/");
  }

  return appUser;
}
