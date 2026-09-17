import Link from "next/link";

import { logout } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Protects every route under /admin/* — Next.js layouts wrap all nested
 * pages, so this one requireAdmin() call gates the whole subtree.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

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
