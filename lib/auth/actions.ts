"use server";

/**
 * Login and logout Server Actions — CLAUDE.md "Server Actions for mutations,
 * not API routes." docs/03-data-model.md: "Auth via Supabase email/password.
 * No self-signup — admin provisioning only," so there is no register action
 * here, on purpose.
 *
 * Session 7A: single-active-session enforcement (one active_sessions row per
 * user; a new login deletes any prior row — a takeover). Session 7B adds
 * sharing-detection: session_events logging and account_flags, both purely
 * informational (never blocks a login).
 */

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { activeSessions, sessionEvents, users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

import { evaluateSharingSignals } from "./flagging";
import { extractGeoFromHeaders } from "./geo";
import { loginSchema } from "./login-schema";
import { isGeoJump } from "./sessionSecurity";
import { generateSessionToken, SESSION_TOKEN_COOKIE } from "./sessionToken";

export interface LoginFormState {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}

const INVALID_CREDENTIALS_ERROR = "Incorrect email or password.";
const ACCOUNT_NOT_FOUND_ERROR = "Account not found or inactive.";

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  // Generic error on any Supabase auth failure — never reveals whether the
  // email is registered.
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  // `users.id` is set to exactly auth.users.id at account-creation time (see
  // lib/db/create-admin.ts), so this is a single equality lookup — no join,
  // no email match needed.
  const db = getDb();
  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authData.user.id))
    .limit(1);

  if (!appUser || !appUser.isActive) {
    // Never leave an authenticated Supabase session behind for a row that
    // doesn't exist or is deactivated on our side.
    await supabase.auth.signOut();
    return { error: ACCOUNT_NOT_FOUND_ERROR };
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");
  const geo = extractGeoFromHeaders(headerList);

  const now = new Date();

  // Capture the row about to be replaced BEFORE deleting it — this IS the
  // takeover case, and its ip/user-agent/geo are the "previous" side of the
  // takeover/ua_change/geo_jump events logged below.
  const [previousSession] = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.userId, appUser.id))
    .limit(1);

  // Single active session enforcement — Part A: last login always wins.
  await db.delete(activeSessions).where(eq(activeSessions.userId, appUser.id));

  const sessionToken = generateSessionToken();

  await db.insert(activeSessions).values({
    orgId: appUser.orgId,
    userId: appUser.id,
    sessionToken,
    ipAddress,
    userAgent,
    geoCountry: geo.country,
    geoCity: geo.city,
    createdAt: now,
    lastSeenAt: now,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_TOKEN_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, appUser.id));

  // --- Session 7B: sharing-detection event logging ------------------------
  // session_events has no geo_city column (verified against lib/db/schema.ts
  // — only geo_country exists there, unlike active_sessions), so only
  // geo_country is logged here.
  type NewSessionEvent = typeof sessionEvents.$inferInsert;
  const eventsToLog: NewSessionEvent[] = [
    {
      orgId: appUser.orgId,
      userId: appUser.id,
      eventType: "login",
      ipAddress,
      userAgent,
      geoCountry: geo.country,
      createdAt: now,
    },
  ];

  if (previousSession) {
    // The takeover itself.
    eventsToLog.push({
      orgId: appUser.orgId,
      userId: appUser.id,
      eventType: "takeover",
      ipAddress,
      userAgent,
      geoCountry: geo.country,
      previousIp: previousSession.ipAddress,
      previousGeo: previousSession.geoCountry,
      createdAt: now,
    });

    if (previousSession.userAgent !== userAgent) {
      eventsToLog.push({
        orgId: appUser.orgId,
        userId: appUser.id,
        eventType: "ua_change",
        ipAddress,
        userAgent,
        geoCountry: geo.country,
        previousIp: previousSession.ipAddress,
        previousGeo: previousSession.geoCountry,
        createdAt: now,
      });
    }

    if (
      isGeoJump(
        {
          country: previousSession.geoCountry,
          at: previousSession.lastSeenAt ?? previousSession.createdAt,
        },
        { country: geo.country, at: now },
      )
    ) {
      eventsToLog.push({
        orgId: appUser.orgId,
        userId: appUser.id,
        eventType: "geo_jump",
        ipAddress,
        userAgent,
        geoCountry: geo.country,
        previousIp: previousSession.ipAddress,
        previousGeo: previousSession.geoCountry,
        createdAt: now,
      });
    }
  }

  const insertedEvents = await db
    .insert(sessionEvents)
    .values(eventsToLog)
    .returning();

  const geoJumpEvent = insertedEvents.find(
    (event) => event.eventType === "geo_jump",
  );

  // Purely informational — never blocks or denies this login.
  await evaluateSharingSignals({
    userId: appUser.id,
    orgId: appUser.orgId,
    now,
    justLoggedGeoJump: geoJumpEvent
      ? { eventId: geoJumpEvent.id, createdAt: geoJumpEvent.createdAt }
      : null,
  });

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logging out should never look like a takeover: remove the row entirely
  // rather than leaving it for the next login to "discover" as an existing
  // session.
  if (user) {
    const db = getDb();
    await db.delete(activeSessions).where(eq(activeSessions.userId, user.id));
  }

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_TOKEN_COOKIE);

  redirect("/login");
}
