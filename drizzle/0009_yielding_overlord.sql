CREATE INDEX "active_sessions_user_id_idx" ON "active_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempts_session_id_idx" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "question_sets_org_type_status_idx" ON "question_sets" USING btree ("org_id","type","status");--> statement-breakpoint
CREATE INDEX "questions_org_type_status_idx" ON "questions" USING btree ("org_id","type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_attempt_trait_unique" ON "scores" USING btree ("attempt_id","trait");--> statement-breakpoint
CREATE INDEX "sessions_user_started_idx" ON "sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_open_per_set" ON "sessions" USING btree ("user_id","question_set_id","mode") WHERE "sessions"."status" = 'in_progress' AND "sessions"."retry_of_session_id" IS NULL AND "sessions"."question_set_id" IS NOT NULL;