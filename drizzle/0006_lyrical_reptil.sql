ALTER TABLE "attempts" ADD COLUMN "question_type" "question_type";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "question_version" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "is_correct" boolean;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Hand-written: backfill attempts saved before these columns existed. Questions have never been edited, so version 1 is accurate.
UPDATE "attempts" SET "question_type" = q."type", "question_version" = 1 FROM "questions" q WHERE "attempts"."question_id" = q."id" AND "attempts"."question_type" IS NULL;--> statement-breakpoint
UPDATE "attempts" SET "is_correct" = (s."score" >= s."max_score") FROM "scores" s WHERE s."attempt_id" = "attempts"."id" AND s."trait" = 'overall';--> statement-breakpoint
-- Hand-written: bump a question's version whenever its content changes, from any source (this app, the SQL editor, a future admin editor).
CREATE OR REPLACE FUNCTION "questions_bump_version"() RETURNS trigger AS $$
BEGIN
  IF NEW."payload" IS DISTINCT FROM OLD."payload" THEN
    NEW."version" := OLD."version" + 1;
    NEW."updated_at" := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "questions_bump_version_trg" BEFORE UPDATE ON "questions" FOR EACH ROW EXECUTE FUNCTION "questions_bump_version"();
