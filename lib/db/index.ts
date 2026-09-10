import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

/**
 * Drizzle client over the Supabase Postgres connection.
 *
 * Lazily constructed so importing this module never opens a connection or reads
 * env at build time. Call `getDb()` from server code (Server Actions, route
 * handlers, background jobs) when you actually need a query.
 */

type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;
  const { DATABASE_URL } = serverEnv();
  client = postgres(DATABASE_URL, { prepare: false });
  db = drizzle(client, { schema });
  return db;
}
