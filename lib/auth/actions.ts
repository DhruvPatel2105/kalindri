"use server";

/**
 * Login and logout Server Actions — CLAUDE.md "Server Actions for mutations,
 * not API routes." docs/03-data-model.md: "Auth via Supabase email/password.
 * No self-signup — admin provisioning only," so there is no register action
 * here, on purpose.
 *
 * Session 6 scope only: no single-session enforcement, no session_events
 * logging, no account_flags. Those are session 7.
 */

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

import { loginSchema } from "./login-schema";

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

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, appUser.id));

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
