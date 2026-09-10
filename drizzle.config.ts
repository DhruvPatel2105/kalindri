import { defineConfig } from "drizzle-kit";

/**
 * `npm run db:generate` works offline (it only reads the schema).
 * `db:migrate` / `db:studio` need a real DATABASE_URL — set it in the
 * environment or in `.env.local` and pass it through (see README).
 */
const url =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
