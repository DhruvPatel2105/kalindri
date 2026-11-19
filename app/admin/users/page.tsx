import { eq } from "drizzle-orm";
import Link from "next/link";

import { ACTIVITY_TIME_ZONE, dayInZone, formatSpent } from "@/lib/activity/activity";
import { getActivityOverview } from "@/lib/activity/queries";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

import { CreateUserForm } from "./CreateUserForm";
import { ToggleActiveButton } from "./ToggleActiveButton";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * app/admin/layout.tsx already calls requireAdmin() to protect this route;
 * this page calls it again to get the org-scoped admin row back (org_id
 * isn't otherwise passed down from the layout).
 */
export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const db = getDb();
  // CLAUDE.md #8: org_id is structural, never omitted from a query — even
  // though only one organization exists today.
  const today = dayInZone(new Date());
  const [orgUsers, activity] = await Promise.all([
    db.select().from(users).where(eq(users.orgId, admin.orgId)),
    getActivityOverview(db, { orgId: admin.orgId, today }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#1e2a2a]">Users</h2>
      <p className="-mt-3 text-xs text-[#7d8a88]">
        Time is active time in the app (tab open and in use), counted by day in {ACTIVITY_TIME_ZONE}. Idle
        time and closed tabs are not counted.
      </p>

      <CreateUserForm />

      <div className="overflow-x-auto rounded border border-[#ddd9d0] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#ddd9d0] bg-[#fafaf8] text-[#5c6a68]">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2 font-medium">Today</th>
              <th className="px-4 py-2 font-medium">Yesterday</th>
              <th className="px-4 py-2 font-medium">Last 7 days</th>
              <th className="px-4 py-2 font-medium">Last 30 days</th>
              <th className="px-4 py-2 font-medium">Last active</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgUsers.map((user) => {
              const a = activity.get(user.id);
              return (
              <tr
                key={user.id}
                className="border-b border-[#ddd9d0] last:border-0"
              >
                <td className="px-4 py-2 text-[#1e2a2a]">{user.fullName ?? "—"}</td>
                <td className="px-4 py-2 text-[#1e2a2a]">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-[#1f6f6b] hover:text-[#17544f] hover:underline"
                  >
                    {user.email}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[#1e2a2a]">{user.role}</td>
                <td className="px-4 py-2 text-[#1e2a2a]">
                  {user.isActive ? "Yes" : "No"}
                </td>
                <td className="px-4 py-2 text-[#5c6a68]">
                  {dateFormatter.format(user.createdAt)}
                </td>
                <td className="px-4 py-2 text-[#5c6a68]">
                  {user.lastLoginAt
                    ? dateFormatter.format(user.lastLoginAt)
                    : "Never"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">{formatSpent(a?.today ?? 0)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">{formatSpent(a?.yesterday ?? 0)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">{formatSpent(a?.last7 ?? 0)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">{formatSpent(a?.last30 ?? 0)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-[#5c6a68]">
                  {a?.lastActiveAt ? dateFormatter.format(a.lastActiveAt) : "Never"}
                </td>
                <td className="px-4 py-2">
                  {user.id === admin.id ? (
                    <span className="text-xs text-[#7d8a88]">You</span>
                  ) : (
                    <ToggleActiveButton
                      userId={user.id}
                      isActive={user.isActive}
                    />
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
