import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";

import {
  formatReasonLabel,
  formatSignalDataSummary,
  getLatestEventId,
} from "@/lib/auth/flagFormatting";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { accountFlags, sessionEvents, users } from "@/lib/db/schema";

import { FlagActions } from "./FlagActions";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Read-only display plus two status-transition actions — see
 * app/admin/flags/actions.ts. Resolving or dismissing a flag NEVER touches
 * users.is_active; deactivation is a separate, deliberate admin action via
 * toggleUserActiveAction (app/admin/users/actions.ts).
 */
export default async function AdminFlagsPage() {
  const admin = await requireAdmin();

  const db = getDb();
  const openFlags = await db
    .select({
      id: accountFlags.id,
      userId: accountFlags.userId,
      userEmail: users.email,
      reason: accountFlags.reason,
      signalData: accountFlags.signalData,
      createdAt: accountFlags.createdAt,
    })
    .from(accountFlags)
    .innerJoin(users, eq(accountFlags.userId, users.id))
    .where(and(eq(accountFlags.orgId, admin.orgId), eq(accountFlags.status, "open")))
    .orderBy(desc(accountFlags.createdAt));

  // Enrichment for 'impossible_travel' flags: signal_data only stores the
  // triggering session_events row's id, not the countries themselves — see
  // lib/auth/flagFormatting.ts's module doc. Fetched in one batch query,
  // not per-flag.
  const geoJumpEventIds = openFlags
    .filter((flag) => flag.reason === "impossible_travel")
    .map((flag) => getLatestEventId(flag.signalData))
    .filter((id): id is string => id !== null);

  const geoJumpEvents =
    geoJumpEventIds.length > 0
      ? await db
          .select({
            id: sessionEvents.id,
            geoCountry: sessionEvents.geoCountry,
            previousGeo: sessionEvents.previousGeo,
          })
          .from(sessionEvents)
          .where(inArray(sessionEvents.id, geoJumpEventIds))
      : [];

  const geoJumpEventById = new Map(
    geoJumpEvents.map((event) => [event.id, event]),
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-[#1e2a2a]">Open flags</h2>

      {openFlags.length === 0 ? (
        <p className="text-sm text-[#5c6a68]">No open flags.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {openFlags.map((flag) => {
            const geoJumpEventId =
              flag.reason === "impossible_travel"
                ? getLatestEventId(flag.signalData)
                : null;
            const geoJumpEvent = geoJumpEventId
              ? geoJumpEventById.get(geoJumpEventId)
              : undefined;

            const summary = formatSignalDataSummary(
              flag.reason,
              flag.signalData,
              {
                geoJump: geoJumpEvent
                  ? {
                      currentCountry: geoJumpEvent.geoCountry,
                      previousCountry: geoJumpEvent.previousGeo,
                    }
                  : null,
              },
            );

            return (
              <div
                key={flag.id}
                className="flex flex-col gap-2 rounded border border-[#ddd9d0] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/admin/users/${flag.userId}`}
                      className="font-medium text-[#1f6f6b] hover:text-[#17544f]"
                    >
                      {flag.userEmail}
                    </Link>
                    <p className="text-sm font-semibold text-[#1e2a2a]">
                      {formatReasonLabel(flag.reason)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-[#7d8a88]">
                      {dateFormatter.format(flag.createdAt)}
                    </span>
                    <FlagActions flagId={flag.id} />
                  </div>
                </div>

                {summary.kind === "text" ? (
                  <p className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-3 py-2 text-sm text-[#1e2a2a]">
                    {summary.text}
                  </p>
                ) : (
                  <pre className="overflow-x-auto rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-3 py-2 text-xs text-[#5c6a68]">
                    {summary.json}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
