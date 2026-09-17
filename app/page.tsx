import { logout } from "@/lib/auth/actions";
import { requireActiveSession } from "@/lib/auth/requireActiveSession";

/**
 * Deliberately the whole UI for session 6/7A: proves the login round trip
 * and single-active-session enforcement work end to end. Admin dashboard,
 * practice flows etc. are later sessions.
 *
 * This is currently the ONLY protected route, so it's the only call site
 * for requireActiveSession(). Any FUTURE protected page must call that same
 * helper too — or, once there's more than one protected route, move this
 * check into a shared layout instead of repeating it per page.
 */
export default async function HomePage() {
  const appUser = await requireActiveSession();

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
