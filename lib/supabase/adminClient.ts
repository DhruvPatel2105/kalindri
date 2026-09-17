import "server-only";

/**
 * Service-role Supabase client for privileged admin-API calls from inside
 * the running app (creating Auth users, etc.) — bypasses Row Level
 * Security. `server-only` marked: this holds SUPABASE_SERVICE_ROLE_KEY and
 * must never reach a client bundle.
 *
 * supabase-js's `createClient()` throws on Node 20 without a WebSocket
 * implementation supplied — it constructs a RealtimeClient internally even
 * though this app never uses realtime. This is the exact bug that silently
 * broke lib/db/create-admin.ts until the `ws` package fixed it there.
 * Fixed once, here, for every app-side caller — do not construct a second,
 * differently-configured admin client elsewhere.
 *
 * lib/db/create-admin.ts keeps its OWN inline copy of this same fix rather
 * than importing this file: it's a standalone script run via `tsx`, outside
 * Next's bundler. `server-only`'s non-`react-server` export unconditionally
 * throws on import (that's what protects this file from ever landing in a
 * browser bundle) — which would also break the CLI script if it tried to
 * import this module directly.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { clientEnv, serverEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const { NEXT_PUBLIC_SUPABASE_URL } = clientEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  adminClient = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as never },
  });

  return adminClient;
}
