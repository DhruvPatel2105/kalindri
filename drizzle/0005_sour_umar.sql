CREATE TYPE "public"."session_type" AS ENUM('FULL_PRACTICE', 'INCORRECT_PRACTICE');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "root_session_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "session_type" "session_type";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_root_session_id_sessions_id_fk" FOREIGN KEY ("root_session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_root_session_id_idx" ON "sessions" USING btree ("root_session_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_type_matches_parent" CHECK ("sessions"."session_type" IS NULL OR ("sessions"."session_type" = 'FULL_PRACTICE') = ("sessions"."retry_of_session_id" IS NULL));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_full_practice_is_own_root" CHECK ("sessions"."retry_of_session_id" IS NOT NULL OR "sessions"."root_session_id" IS NULL OR "sessions"."root_session_id" = "sessions"."id");--> statement-breakpoint
-- Backfill the new columns for practice-test sessions that already exist (hand-written; drizzle-kit does not generate data changes).
UPDATE "sessions" SET "session_type" = (CASE WHEN "retry_of_session_id" IS NULL THEN 'FULL_PRACTICE' ELSE 'INCORRECT_PRACTICE' END)::"session_type" WHERE "mode" = 'practice' AND "question_set_id" IS NOT NULL;--> statement-breakpoint
UPDATE "sessions" SET "root_session_id" = "id" WHERE "mode" = 'practice' AND "question_set_id" IS NOT NULL AND "retry_of_session_id" IS NULL;--> statement-breakpoint
WITH RECURSIVE "journey" AS (
  SELECT "id", "id" AS "root" FROM "sessions" WHERE "root_session_id" = "id"
  UNION ALL
  SELECT s."id", j."root" FROM "sessions" s JOIN "journey" j ON s."retry_of_session_id" = j."id"
)
UPDATE "sessions" SET "root_session_id" = "journey"."root" FROM "journey" WHERE "sessions"."id" = "journey"."id" AND "sessions"."retry_of_session_id" IS NOT NULL;
