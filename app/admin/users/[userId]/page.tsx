import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ACTIVITY_TIME_ZONE,
  addDays,
  dayInZone,
  describeAreas,
  formatSpent,
  isDay,
  summarizeActivity,
} from "@/lib/activity/activity";
import { getUserActivityBounds, getUserDays } from "@/lib/activity/queries";
import {
  formatReasonLabel,
  formatSignalDataSummary,
} from "@/lib/auth/flagFormatting";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { accountFlags, sessionEvents, users } from "@/lib/db/schema";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

const EVENT_HISTORY_LIMIT = 50;

function formatLocation(
  geoCountry: string | null,
  geoCity: string | null,
): string {
  if (!geoCountry) return "—";
  return geoCity ? `${geoCity}, ${geoCountry}` : geoCountry;
}

/**
 * Read-only, full picture on one person — every flag regardless of status
 * (unlike app/admin/flags/page.tsx, which only shows 'open' ones), plus
 * their recent session_events. No write actions on this page at all.
 */
export default async function UserActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const admin = await requireAdmin();
  const { userId } = await params;
  const query = await searchParams;

  const db = getDb();

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Same 404 whether the user doesn't exist at all or belongs to another
  // org — never leak which case it is.
  if (!targetUser || targetUser.orgId !== admin.orgId) {
    notFound();
  }

  // Date filter: ?from=YYYY-MM-DD&to=YYYY-MM-DD, default the last 30 days.
  const today = dayInZone(new Date());
  let to = query.to && isDay(query.to) ? query.to : today;
  let from = query.from && isDay(query.from) ? query.from : addDays(to, -29);
  if (from > to) [from, to] = [to, from];

  const [events, flags, days, bounds] = await Promise.all([
    db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.userId, targetUser.id))
      .orderBy(desc(sessionEvents.createdAt))
      .limit(EVENT_HISTORY_LIMIT),
    db
      .select()
      .from(accountFlags)
      .where(eq(accountFlags.userId, targetUser.id))
      .orderBy(desc(accountFlags.createdAt)),
    getUserDays(db, { orgId: admin.orgId, userId: targetUser.id, from, to }),
    getUserActivityBounds(db, { orgId: admin.orgId, userId: targetUser.id }),
  ]);
  const summary = summarizeActivity(days);
  const presets = [
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "Last 90 days", from: addDays(today, -89), to: today },
    ...(bounds.firstDay ? [{ label: "All time", from: bounds.firstDay, to: today }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/users"
          className="text-sm text-[#1f6f6b] hover:text-[#17544f]"
        >
          ← Back to users
        </Link>
        <h2 className="text-xl font-semibold text-[#1e2a2a]">
          {targetUser.fullName ? `${targetUser.fullName} · ` : ""}{targetUser.email}
        </h2>
        <p className="text-sm text-[#5c6a68]">
          {targetUser.role} · {targetUser.isActive ? "Active" : "Inactive"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#1e2a2a]">Time spent</h3>
        <p className="text-xs text-[#7d8a88]">
          Active time in the app (tab open and in use), by day in {ACTIVITY_TIME_ZONE}. Idle time and closed tabs
          are not counted.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col text-xs text-[#5c6a68]">
              From
              <input type="date" name="from" defaultValue={from} className="rounded border border-[#ddd9d0] bg-white px-2 py-1 text-sm" />
            </label>
            <label className="flex flex-col text-xs text-[#5c6a68]">
              To
              <input type="date" name="to" defaultValue={to} className="rounded border border-[#ddd9d0] bg-white px-2 py-1 text-sm" />
            </label>
            <button type="submit" className="rounded bg-[#1f6f6b] px-3 py-1 text-sm font-medium text-white hover:bg-[#17544f]">
              Apply
            </button>
          </form>
          <div className="flex flex-wrap gap-2 text-xs">
            {presets.map((preset) => (
              <Link
                key={preset.label}
                href={`/admin/users/${targetUser.id}?from=${preset.from}&to=${preset.to}`}
                className="rounded border border-[#ddd9d0] bg-white px-2 py-1 text-[#1f6f6b] hover:border-[#1f6f6b]"
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total time", formatSpent(summary.totalSeconds)],
            ["Average per active day", formatSpent(summary.averageSecondsPerActiveDay)],
            ["Active days", String(summary.activeDays)],
            ["Last active", bounds.lastActiveAt ? dateFormatter.format(bounds.lastActiveAt) : "Never"],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-[#ddd9d0] bg-white px-3 py-2">
              <p className="text-xs text-[#7d8a88]">{label}</p>
              <p className="text-sm font-semibold text-[#1e2a2a]">{value}</p>
            </div>
          ))}
        </div>

        {days.length === 0 ? (
          <p className="text-sm text-[#5c6a68]">No activity recorded for {from} to {to}.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-[#ddd9d0] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ddd9d0] bg-[#fafaf8] text-[#5c6a68]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Time spent</th>
                    <th className="px-4 py-2 font-medium">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((row) => (
                    <tr key={row.day} className="border-b border-[#ddd9d0] last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-[#1e2a2a]">{row.day}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-[#1e2a2a]">{formatSpent(row.seconds)}</td>
                      <td className="px-4 py-2 text-[#5c6a68]">{describeAreas(row.byArea) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">Most active days</p>
              <ul className="mt-1 text-sm text-[#1e2a2a]">
                {summary.mostActive.map((row) => (
                  <li key={row.day}>
                    {row.day} — {formatSpent(row.seconds)}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#1e2a2a]">
          Account flags
        </h3>
        {flags.length === 0 ? (
          <p className="text-sm text-[#5c6a68]">No flags on this account.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {flags.map((flag) => {
              const summary = formatSignalDataSummary(
                flag.reason,
                flag.signalData,
              );
              return (
                <div
                  key={flag.id}
                  className="flex flex-col gap-1 rounded border border-[#ddd9d0] bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[#1e2a2a]">
                      {formatReasonLabel(flag.reason)}
                    </span>
                    <span className="text-xs capitalize text-[#7d8a88]">
                      {flag.status}
                    </span>
                  </div>
                  <span className="text-xs text-[#7d8a88]">
                    {dateFormatter.format(flag.createdAt)}
                  </span>
                  {summary.kind === "text" ? (
                    <p className="text-sm text-[#1e2a2a]">{summary.text}</p>
                  ) : (
                    <pre className="overflow-x-auto text-xs text-[#5c6a68]">
                      {summary.json}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#1e2a2a]">
          Session activity (last {EVENT_HISTORY_LIMIT})
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-[#5c6a68]">
            No session activity recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-[#ddd9d0] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#ddd9d0] bg-[#fafaf8] text-[#5c6a68]">
                <tr>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-[#ddd9d0] last:border-0"
                  >
                    <td className="px-4 py-2 text-[#1e2a2a]">
                      {event.eventType}
                    </td>
                    <td className="px-4 py-2 text-[#5c6a68]">
                      {dateFormatter.format(event.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-[#5c6a68]">
                      {event.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[#5c6a68]">
                      {formatLocation(event.geoCountry, event.geoCity)}
                    </td>
                    <td
                      className="max-w-xs truncate px-4 py-2 text-[#5c6a68]"
                      title={event.userAgent ?? undefined}
                    >
                      {event.userAgent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
