import { isAdminRole } from "@/lib/auth/isAdminRole";
import { requireActiveSession } from "@/lib/auth/requireActiveSession";

import { ActivityTracker } from "./ActivityTracker";
import { NavBar } from "./NavBar";

/**
 * The standard navigation bar for signed-in pages: home, a Practice menu that
 * lists every question type under Speaking / Writing / Reading / Listening,
 * test history, and account actions. No score weights here — those live on
 * the home page.
 */
export async function AppNav() {
  const user = await requireActiveSession();
  return (
    <>
      <ActivityTracker />
      <NavBar email={user.email} isAdmin={isAdminRole(user.role)} />
    </>
  );
}
