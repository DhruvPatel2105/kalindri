/**
 * One-off script: creates the first admin account. NOT part of the app
 * runtime — never imported from `app/` or `lib/` application code, and there
 * is no route that can reach it. Local/ops tool only.
 *
 * Run with:  npm run create-admin -- --email you@example.com --password '...'
 *            npm run create-admin                (prompts for both instead)
 *
 * Note: the interactive prompt does NOT mask password input (no extra
 * dependency for it). Prefer the --password flag on a machine you trust, or
 * pipe it in from a secrets manager.
 *
 * Idempotent: if a `users` row already exists for the given email, this
 * fails loudly and does nothing else — it never creates a duplicate Auth
 * user or silently no-ops. If the Auth user is created but the `users`
 * insert then fails for any reason, the Auth user is deleted again so a
 * retry isn't blocked by an orphaned Auth account.
 *
 * CRITICAL: `users.id` is set to EXACTLY the Supabase Auth user's id — see
 * CLAUDE.md and docs/03-data-model.md. Never let it fall back to
 * `defaultRandom()`.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import { organizations, users } from "./schema";

// Must match lib/db/seed.ts's ORG_SLUG — the organization seeded in session 2.
const ORG_SLUG = "kalindri";

const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

async function resolveCredentials(): Promise<{ email: string; password: string }> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  let email = values.email;
  let password = values.password;

  if (!email || !password) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      if (!email) {
        email = (await rl.question("Admin email: ")).trim();
      }
      if (!password) {
        console.log("(password will be visible as you type — not masked)");
        password = await rl.question("Admin password: ");
      }
    } finally {
      rl.close();
    }
  }

  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid admin credentials:\n${message}`);
  }
  return parsed.data;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "must all be set. Copy .env.example to .env.local and fill them in.",
    );
  }

  const { email, password } = await resolveCredentials();

  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(sql);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // This script only needs the Auth admin API, never realtime — but
    // supabase-js still constructs a RealtimeClient internally and throws
    // on Node 20 without a WebSocket implementation supplied. `ws` fixes it.
    realtime: { transport: WebSocket as never },
  });

  try {
    // 1. Fail loudly if this email is already provisioned — the idempotency
    //    guarantee. Checked before touching Supabase Auth at all.
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      throw new Error(
        `A user with email "${email}" already exists (id ${existing.id}). Refusing to create a duplicate.`,
      );
    }

    // 2. Look up the seeded organization.
    const [org] = await db
      .select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);
    if (!org) {
      throw new Error(
        `No organization found with slug "${ORG_SLUG}". Run "npm run db:seed" first.`,
      );
    }

    // 3. Create the Supabase Auth user via the admin API.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError || !authData.user) {
      throw new Error(
        `Supabase Auth rejected user creation: ${authError?.message ?? "unknown error"}`,
      );
    }

    // 4. Insert the matching row into OUR users table — same id as the Auth
    //    user, explicitly (never the column's own defaultRandom()).
    try {
      await db.insert(users).values({
        id: authData.user.id,
        orgId: org.id,
        email,
        role: "admin",
        isActive: true,
      });
    } catch (dbError) {
      // Roll back the orphaned Auth user so a retry isn't blocked by it.
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    console.log(
      `Created admin "${email}" (id ${authData.user.id}) in organization "${org.slug}".`,
    );
  } finally {
    await sql.end();
  }
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
