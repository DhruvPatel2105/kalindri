import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";
import { shouldPrepare } from "@/lib/db/prepare";
import * as schema from "@/lib/db/schema";

/**
 * Drizzle client over the Supabase Postgres connection.
 *
 * Lazily constructed so importing this module never opens a connection or reads
 * env at build time. Call `getDb()` from server code (Server Actions, route
 * handlers, background jobs) when you actually need a query.
 *
 * Connection budget: Supabase's pooler allows only a fixed number of clients
 * (15 in session mode), shared by everything that connects — the dev server,
 * every deployed serverless instance and any scripts. So:
 *   - the pool is small (POOL_MAX). postgres.js pipelines queries on an open
 *     connection, so parallel reads stay parallel without many connections;
 *   - idle connections are closed after IDLE_TIMEOUT_S (10 minutes) instead
 *     of being held for ever. Not shorter: reconnecting to the database costs
 *     ~2.4 s (measured), which a student reading a question for a minute
 *     would otherwise pay on their next click;
 *   - the client lives on `globalThis`, so the dev server's hot reloads reuse
 *     it rather than leaking a new pool on every recompile (the cause of
 *     "EMAXCONNSESSION: max clients reached").
 */

type Database = PostgresJsDatabase<typeof schema>;

const POOL_MAX = 5;
const IDLE_TIMEOUT_S = 600;
const CONNECT_TIMEOUT_S = 15;

const globalForDb = globalThis as typeof globalThis & {
  __kalindriDb?: Database;
};

export function getDb(): Database {
  if (globalForDb.__kalindriDb) return globalForDb.__kalindriDb;
  const { DATABASE_URL, DATABASE_PREPARE } = serverEnv();
  const prepare = shouldPrepare(DATABASE_URL, DATABASE_PREPARE);
  const client = postgres(DATABASE_URL, {
    prepare,
    max: POOL_MAX,
    idle_timeout: IDLE_TIMEOUT_S,
    connect_timeout: CONNECT_TIMEOUT_S,
  });

  // Prepared statements: a query with parameters then costs ONE network round
  // trip instead of two (measured against the Supabase pooler: ~300 ms
  // instead of ~600 ms per query, and four parallel queries ~300 ms instead
  // of ~610 ms). Session pooler / direct only — see shouldPrepare.
  //
  // Drizzle issues every query through `client.unsafe(...)`, and postgres.js
  // never prepares `unsafe` queries unless told to per call — so the
  // client-wide `prepare` option alone does nothing for Drizzle. Default it
  // per call here instead. (Queries inside `db.transaction` run on
  // postgres.js's own transaction handle and stay unprepared; that only
  // affects the few statements of a submit.)
  if (prepare) {
    const unsafe = client.unsafe.bind(client) as typeof client.unsafe;
    client.unsafe = ((query: string, parameters?: never[], options?: object) =>
      unsafe(query, parameters, { prepare: true, ...options })) as typeof client.unsafe;
  }

  const db = drizzle(client, { schema });
  globalForDb.__kalindriDb = db;
  return db;
}
