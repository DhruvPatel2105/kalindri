ALTER TABLE "attempts" ADD COLUMN "scoring_rules" jsonb;--> statement-breakpoint
CREATE INDEX "attempts_user_question_idx" ON "attempts" USING btree ("user_id","question_id");