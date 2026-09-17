import { and, count, eq } from "drizzle-orm";
import Link from "next/link";

import { logout } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { accountFlags } from "@/lib/db/schema";

/**
 * Protects every route under /admin/* — Next.js layouts wrap all nested
 * pages, so this one requireAdmin() call gates the whole subtree.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  // Cheap to compute here — one count query, self-contained in the layout
  // (no restructuring needed to pass data down from anywhere else).
  const db = getDb();
  const [openFlagCountRow] = await db
    .select({ value: count() })
    .from(accountFlags)
    .where(and(eq(accountFlags.orgId, admin.orgId), eq(accountFlags.status, "open")));
  const openFlagCount = openFlagCountRow?.value ?? 0;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="flex items-center justify-between border-b border-[#ddd9d0] bg-white px-6 py-4">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold text-[#1e2a2a]">
            Kalindri Admin
          </h1>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin/users"
              className="text-sm font-medium text-[#1f6f6b] hover:text-[#17544f]"
            >
              Users
            </Link>
            <Link
              href="/admin/flags"
              className="flex items-center gap-1.5 text-sm font-medium text-[#1f6f6b] hover:text-[#17544f]"
            >
              Flags
              {openFlagCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#b0472f] px-1.5 py-0.5 text-xs font-semibold text-white">
                  {openFlagCount}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded bg-[#1f6f6b] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17544f]"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
