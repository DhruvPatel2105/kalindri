-- NOTE: this column was added manually via the Supabase SQL Editor before
-- this migration file was generated. Do NOT run `npm run db:migrate` with
-- this file against a database that already has geo_city — it will fail
-- on the duplicate column. This file exists only so the migration history
-- matches schema.ts for anyone setting up a FRESH database from scratch.
ALTER TABLE "session_events" ADD COLUMN "geo_city" text;