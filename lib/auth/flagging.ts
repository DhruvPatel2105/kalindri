import "server-only";

/**
 * Sharing-detection orchestration — fetches data and calls the pure
 * decision functions in sessionSecurity.ts, then opens/updates
 * account_flags rows. This file itself is not required to be pure and is
 * NOT unit-tested (needs a live DB); sessionSecurity.ts's decision logic is
 * tested exhaustively instead.
 *
 * Called from the login Server Action. NEVER blocks or denies the login —
 * flagging is purely informational, for later admin review. Nothing here
 * auto-blocks anything (CLAUDE.md: "Auto-block a flagged account — flags
 * are for manual admin review only").
 */

import { and, desc, eq, gte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { accountFlags, sessionEvents } from "@/lib/db/schema";

import {
  shouldFlagForLoginFrequency,
  shouldFlagForTakeoverFrequency,
} from "./sessionSecurity";

// Takeover frequency: sessionSecurity's own defaults (3 in 24h).
const TAKEOVER_FREQUENCY_THRESHOLD = 3;
const TAKEOVER_FREQUENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Raw login frequency, independent of takeovers — e.g. credentials shared
// across several people who each cleanly log out before the next logs in,
// so no 'takeover' ever fires. Starting judgment call for admin review, not
// a hard security boundary; easy to retune once there's real usage data.
const LOGIN_FREQUENCY_THRESHOLD = 5;
const LOGIN_FREQUENCY_WINDOW_MS = 60 * 60 * 1000;

export type FlagReason =
  | "frequent_session_takeover"
  | "impossible_travel"
  | "unusual_login_frequency";

interface PendingFlag {
  reason: FlagReason;
  evidence: Record<string, unknown>;
}

export interface EvaluateSharingSignalsParams {
  userId: string;
  orgId: string;
  now: Date;
  /** The 'geo_jump' session_events row just inserted this login, if any. */
  justLoggedGeoJump: { eventId: string; createdAt: Date } | null;
}

export async function evaluateSharingSignals(
  params: EvaluateSharingSignalsParams,
): Promise<void> {
  const { userId, orgId, now, justLoggedGeoJump } = params;
  const db = getDb();
  const pendingFlags: PendingFlag[] = [];

  const takeoverEvents = await db
    .select({ id: sessionEvents.id, createdAt: sessionEvents.createdAt })
    .from(sessionEvents)
    .where(
      and(
        eq(sessionEvents.userId, userId),
        eq(sessionEvents.eventType, "takeover"),
        gte(
          sessionEvents.createdAt,
          new Date(now.getTime() - TAKEOVER_FREQUENCY_WINDOW_MS),
        ),
      ),
    )
    .orderBy(desc(sessionEvents.createdAt));

  if (
    shouldFlagForTakeoverFrequency(
      takeoverEvents,
      now,
      TAKEOVER_FREQUENCY_THRESHOLD,
      TAKEOVER_FREQUENCY_WINDOW_MS,
    )
  ) {
    pendingFlags.push({
      reason: "frequent_session_takeover",
      evidence: {
        eventIds: takeoverEvents.map((event) => event.id),
        thresholdCount: TAKEOVER_FREQUENCY_THRESHOLD,
        windowMs: TAKEOVER_FREQUENCY_WINDOW_MS,
        detectedAt: now.toISOString(),
      },
    });
  }

  const loginEvents = await db
    .select({ id: sessionEvents.id, createdAt: sessionEvents.createdAt })
    .from(sessionEvents)
    .where(
      and(
        eq(sessionEvents.userId, userId),
        eq(sessionEvents.eventType, "login"),
        gte(
          sessionEvents.createdAt,
          new Date(now.getTime() - LOGIN_FREQUENCY_WINDOW_MS),
        ),
      ),
    )
    .orderBy(desc(sessionEvents.createdAt));

  if (
    shouldFlagForLoginFrequency(
      loginEvents,
      now,
      LOGIN_FREQUENCY_THRESHOLD,
      LOGIN_FREQUENCY_WINDOW_MS,
    )
  ) {
    pendingFlags.push({
      reason: "unusual_login_frequency",
      evidence: {
        eventIds: loginEvents.map((event) => event.id),
        thresholdCount: LOGIN_FREQUENCY_THRESHOLD,
        windowMs: LOGIN_FREQUENCY_WINDOW_MS,
        detectedAt: now.toISOString(),
      },
    });
  }

  if (justLoggedGeoJump) {
    // Single-occurrence signal — sufficient to flag immediately, no
    // frequency threshold needed.
    pendingFlags.push({
      reason: "impossible_travel",
      evidence: {
        eventIds: [justLoggedGeoJump.eventId],
        detectedAt: justLoggedGeoJump.createdAt.toISOString(),
      },
    });
  }

  for (const flag of pendingFlags) {
    await upsertOpenFlag(db, userId, orgId, flag);
  }
}

async function upsertOpenFlag(
  db: ReturnType<typeof getDb>,
  userId: string,
  orgId: string,
  flag: PendingFlag,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(accountFlags)
    .where(
      and(
        eq(accountFlags.userId, userId),
        eq(accountFlags.reason, flag.reason),
        eq(accountFlags.status, "open"),
      ),
    )
    .limit(1);

  if (existing) {
    const priorSignalData =
      existing.signalData && typeof existing.signalData === "object"
        ? (existing.signalData as Record<string, unknown>)
        : {};
    const priorEvidence = Array.isArray(priorSignalData.evidence)
      ? priorSignalData.evidence
      : [];

    await db
      .update(accountFlags)
      .set({
        signalData: {
          ...priorSignalData,
          evidence: [...priorEvidence, flag.evidence],
        },
      })
      .where(eq(accountFlags.id, existing.id));
    return;
  }

  await db.insert(accountFlags).values({
    orgId,
    userId,
    reason: flag.reason,
    status: "open",
    signalData: { evidence: [flag.evidence] },
  });
}
