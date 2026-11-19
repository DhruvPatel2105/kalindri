/** Pure decision for prepared statements (kept apart from the server-only client so it can be tested). */

/** Supabase's transaction-mode pooler listens on this port. */
const TRANSACTION_POOLER_PORT = "6543";

/**
 * Whether to use prepared statements. They halve the network round trips of
 * every query, but behind a TRANSACTION-mode pooler they are unsafe: measured
 * through Drizzle on Supabase's 6543 pooler they returned silently EMPTY
 * results for ~60% of identical queries (a prepared statement bound on a
 * different backend connection), with no error. So they are on for the
 * session pooler (5432) and direct connections, and refused on 6543.
 */
export function shouldPrepare(databaseUrl: string, setting: "auto" | "true" | "false"): boolean {
  const onTransactionPooler = new URL(databaseUrl).port === TRANSACTION_POOLER_PORT;
  if (setting === "true" && onTransactionPooler) {
    throw new Error(
      "DATABASE_PREPARE=true is unsafe with the transaction pooler (port 6543): prepared statements return wrong results there. Use DATABASE_PREPARE=auto or false.",
    );
  }
  if (setting === "false") return false;
  return !onTransactionPooler;
}

