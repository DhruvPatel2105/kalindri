ALTER TABLE "account_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "active_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "calibration_fixtures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mock_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mock_blueprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "question_bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "question_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "question_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reported_real_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "score_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "score_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skill_estimates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skill_weights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "type_performance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_activity_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Defence in depth: the website only ever reaches these tables through its own server connection (the
-- postgres role, which is not affected by RLS), never through the public API. Take the API roles'
-- table access away completely, and stop new tables from being granted to them by default.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
