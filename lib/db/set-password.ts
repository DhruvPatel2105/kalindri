/**
 * Sets a new password for an existing account. A local/ops tool, like
 * create-admin.ts: never imported by the app and not reachable from any route.
 *
 * Run with:  npm run set-password -- --email someone@example.com
 *
 * It asks for the new password twice, WITHOUT showing what you type — so the
 * password never lands in your terminal history or on screen (do not pass it as
 * a flag). Uses SUPABASE_SERVICE_ROLE_KEY from .env.local. The password must
 * follow the same rules as one chosen in the admin page (8-72 characters).
 *
 * It also signs the account out everywhere (removes its active session), so
 * the old password stops working on devices that were already logged in.
 */

import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import WebSocket from "ws";

import { chosenPasswordProblem } from "@/lib/auth/chosenPassword";

import { activeSessions, users } from "./schema";

/** Reads a line from the terminal without echoing it. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("This needs an interactive terminal (it won't read a password from a pipe)."));
      return;
    }
    stdout.write(prompt);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: "string" } }, strict: true });
  const email = values.email?.trim();
  if (!email) throw new Error("Usage: npm run set-password -- --email someone@example.com");

  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceKey) {
    throw new Error("DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).");
  }

  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(client);
  try {
    const [user] = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new Error(`No account with email "${email}".`);

    const password = await askHidden(`New password for ${email}: `);
    const problem = chosenPasswordProblem(password);
    if (problem) throw new Error(problem);
    if ((await askHidden("Type it again to confirm: ")) !== password) throw new Error("The two passwords didn't match. Nothing was changed.");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket as never },
    });
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error(`Supabase rejected the change: ${error.message}`);

    await db.delete(activeSessions).where(eq(activeSessions.userId, user.id));
    console.log(`Password changed for ${email}. They have been signed out everywhere and must log in again.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
