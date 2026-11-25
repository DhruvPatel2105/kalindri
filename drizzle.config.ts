import { defineConfig } from "drizzle-kit";

/**
 * `npm run db:generate` works offline (it only reads the schema).
 * `db:migrate` / `db:studio` need a real DATABASE_URL — set it in the
 * environment or in `.env.local` and pass it through (see README).
 */
const raw =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// Encrypted like the website's own connection (lib/db/ssl.ts): every remote
// database gets sslmode=require unless the address already says otherwise.
const parsed = new URL(raw);
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.hostname.endsWith(".localhost");
if (!isLocal && !parsed.searchParams.has("sslmode")) parsed.searchParams.set("sslmode", "require");
const url = parsed.toString();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
