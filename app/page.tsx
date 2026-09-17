import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { logout } from "@/lib/auth/actions";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Deliberately the whole UI for session 6: proves the login round trip
 * works end to end. Admin dashboard, practice flows etc. are later sessions.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts already gates this route; these are defence in depth, not
  // the primary check.
  if (!user) {
    redirect("/login");
  }

  const db = getDb();
  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!appUser || !appUser.isActive) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f2ee] px-4">
      <h1 className="text-2xl font-semibold text-[#1e2a2a]">Kalindri</h1>
      <p className="text-[#5c6a68]">
        Signed in as <span className="font-medium">{appUser.email}</span>
        {" · "}
        {appUser.role}
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="rounded bg-[#1f6f6b] px-4 py-2 font-medium text-white hover:bg-[#17544f]"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
