/**
 * Whether to encrypt the connection to the database. Everything that talks to
 * Postgres — the website and every script — goes through this, so passwords,
 * session tokens and answers are never sent over the network in the clear.
 *
 * "require" encrypts the connection (it does not check the server's
 * certificate). A database on this same machine (local development with a
 * local Postgres) is the one case left unencrypted, since nothing crosses a
 * network; Supabase and every other remote host is always encrypted.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function sslFor(databaseUrl: string): "require" | false {
  const { hostname } = new URL(databaseUrl);
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost") ? false : "require";
}
