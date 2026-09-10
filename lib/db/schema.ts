/**
 * Drizzle schema — full data model per `docs/03-data-model.md` (Revision 2).
 *
 * Session 2 scope: schema + migration + seed only. No application logic,
 * no relations helpers, no query code.
 *
 * Rules baked in here:
 *   - ONE `questions` table; per-type data lives in `payload` (JSONB). (CLAUDE.md #1)
 *   - `org_id` on every table except `organizations` itself. One org exists at
 *     launch; multi-tenancy is structural. (CLAUDE.md #8)
 *   - The question-type enum carries all 19 PTE Core types from day one.
 *   - Cross-skill weights live in `skill_weights`, never in code. (CLAUDE.md #14)
 *   - Raw model output persists in `score_runs`, separate from `scores`. (#6)
 *   - Question snapshot copied into the attempt on submit. (#9)
 */

import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * All 19 PTE Core question types. Order and spelling match `CLAUDE.md`.
 * Speaking (5) · Writing (2) · Reading (5) · Listening (7).
 */
export const questionType = pgEnum("question_type", [
  // Speaking
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "DESCRIBE_IMAGE",
  "RESPOND_TO_SITUATION",
  "ANSWER_SHORT_QUESTION",
  // Writing
  "SUMMARIZE_WRITTEN_TEXT",
  "WRITE_EMAIL",
  // Reading
  "FIB_RW",
  "MCM_READING",
  "REORDER_PARAGRAPH",
  "FIB_READING",
  "MCS_READING",
  // Listening
  "SUMMARIZE_SPOKEN_TEXT",
  "MCM_LISTENING",
  "FIB_LISTENING",
  "MCS_LISTENING",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "WRITE_FROM_DICTATION",
]);

export const userRole = pgEnum("user_role", ["student", "admin", "teacher"]);

export const skill = pgEnum("skill", [
  "listening",
  "reading",
  "speaking",
  "writing",
]);

export const questionDifficulty = pgEnum("question_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const questionAccent = pgEnum("question_accent", [
  "en-CA",
  "en-GB",
  "en-US",
  "en-AU",
]);

export const questionStatus = pgEnum("question_status", [
  "draft",
  "review",
  "published",
]);

export const sessionMode = pgEnum("session_mode", [
  "practice",
  "drill",
  "mock",
]);

export const sessionStatus = pgEnum("session_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "abandoned",
  "submitted",
  "timed_out",
]);

export const sessionEventType = pgEnum("session_event_type", [
  "login",
  "takeover",
  "geo_jump",
  "ua_change",
]);

export const accountFlagStatus = pgEnum("account_flag_status", [
  "open",
  "reviewed",
  "dismissed",
]);

export const scoreRunScorerType = pgEnum("score_run_scorer_type", [
  "deterministic",
  "llm",
  "speech",
]);

export const scoreRunStatus = pgEnum("score_run_status", [
  "pending",
  "success",
  "error",
]);

export const mockBuildType = pgEnum("mock_build_type", [
  "system",
  "admin_built",
]);

export const aiApiMode = pgEnum("ai_api_mode", ["standard", "batch"]);

export const scoreFlagStatus = pgEnum("score_flag_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const calibrationSource = pgEnum("calibration_source", [
  "pearson_anchor",
  "hand_scored",
  "override",
]);

/* -------------------------------------------------------------------------- */
/*  Column helpers                                                             */
/* -------------------------------------------------------------------------- */

const pkId = () => uuid("id").primaryKey().defaultRandom();

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * `org_id` — non-null FK to `organizations`. On every table except
 * `organizations` itself.
 */
const orgId = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id);

/* -------------------------------------------------------------------------- */
/*  Tenancy and identity                                                       */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable("organizations", {
  id: pkId(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: pkId(),
  orgId: orgId(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull(),
  fullName: text("full_name"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: createdAt(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/*  Session control and abuse detection                                        */
/* -------------------------------------------------------------------------- */

export const activeSessions = pgTable("active_sessions", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  sessionToken: text("session_token").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  geoCountry: text("geo_country"),
  geoCity: text("geo_city"),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const sessionEvents = pgTable("session_events", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  eventType: sessionEventType("event_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  geoCountry: text("geo_country"),
  previousIp: text("previous_ip"),
  previousGeo: text("previous_geo"),
  createdAt: createdAt(),
});

export const accountFlags = pgTable("account_flags", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  signalData: jsonb("signal_data"),
  status: accountFlagStatus("status").notNull().default("open"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Question bank                                                              */
/* -------------------------------------------------------------------------- */

export const questions = pgTable("questions", {
  id: pkId(),
  orgId: orgId(),
  externalId: text("external_id"),
  type: questionType("type").notNull(),
  part: integer("part"),
  payload: jsonb("payload").notNull(),
  difficulty: questionDifficulty("difficulty"),
  derivedDifficulty: numeric("derived_difficulty"),
  tags: text("tags").array(),
  accent: questionAccent("accent"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  status: questionStatus("status").notNull().default("draft"),
  isActive: boolean("is_active").notNull().default(true),
  source: text("source"),
  sourceNotes: text("source_notes"),
  isSeedData: boolean("is_seed_data").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questionStats = pgTable("question_stats", {
  questionId: uuid("question_id")
    .primaryKey()
    .references(() => questions.id),
  orgId: orgId(),
  attemptCount: integer("attempt_count").notNull().default(0),
  avgScorePct: numeric("avg_score_pct"),
  flagCount: integer("flag_count").notNull().default(0),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/*  Mocks (referenced by sessions)                                             */
/* -------------------------------------------------------------------------- */

export const mockBlueprints = pgTable("mock_blueprints", {
  id: pkId(),
  orgId: orgId(),
  name: text("name").notNull(),
  partConfig: jsonb("part_config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const mocks = pgTable("mocks", {
  id: pkId(),
  orgId: orgId(),
  name: text("name").notNull(),
  blueprintId: uuid("blueprint_id").references(() => mockBlueprints.id),
  buildType: mockBuildType("build_type").notNull(),
  questionIds: uuid("question_ids").array(),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const mockAssignments = pgTable("mock_assignments", {
  id: pkId(),
  orgId: orgId(),
  mockId: uuid("mock_id")
    .notNull()
    .references(() => mocks.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  assignedBy: uuid("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/*  Sessions, attempts, scores                                                 */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable("sessions", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  mode: sessionMode("mode").notNull(),
  blueprintId: uuid("blueprint_id").references(() => mockBlueprints.id),
  mockId: uuid("mock_id").references(() => mocks.id),
  questionIds: uuid("question_ids").array(),
  currentItemIndex: integer("current_item_index").notNull().default(0),
  state: jsonb("state"),
  isTimed: boolean("is_timed").notNull().default(true),
  isScoredForAnalytics: boolean("is_scored_for_analytics")
    .notNull()
    .default(true),
  status: sessionStatus("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const attempts = pgTable("attempts", {
  id: pkId(),
  orgId: orgId(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id),
  questionSnapshot: jsonb("question_snapshot").notNull(),
  response: jsonb("response"),
  audioUrl: text("audio_url"),
  status: attemptStatus("status").notNull(),
  countsTowardStats: boolean("counts_toward_stats").notNull().default(false),
  timeTakenSeconds: integer("time_taken_seconds"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const scores = pgTable("scores", {
  id: pkId(),
  orgId: orgId(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id),
  trait: text("trait").notNull(),
  score: numeric("score").notNull(),
  maxScore: numeric("max_score").notNull(),
  bandDescriptor: text("band_descriptor"),
  feedback: text("feedback"),
  positiveFeedback: text("positive_feedback"),
  isOverridden: boolean("is_overridden").notNull().default(false),
  overriddenBy: uuid("overridden_by").references(() => users.id),
  overrideReason: text("override_reason"),
  scorerVersion: text("scorer_version"),
  createdAt: createdAt(),
});

export const scoreRuns = pgTable("score_runs", {
  id: pkId(),
  orgId: orgId(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id),
  scorerType: scoreRunScorerType("scorer_type").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version"),
  rawOutput: jsonb("raw_output"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cachedTokens: integer("cached_tokens"),
  costUsd: numeric("cost_usd"),
  latencyMs: integer("latency_ms"),
  status: scoreRunStatus("status"),
  errorMessage: text("error_message"),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Calibration and validation                                                 */
/* -------------------------------------------------------------------------- */

export const reportedRealScores = pgTable("reported_real_scores", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  testDate: date("test_date"),
  listening: integer("listening"),
  reading: integer("reading"),
  speaking: integer("speaking"),
  writing: integer("writing"),
  overall: integer("overall"),
  clbListening: integer("clb_listening"),
  clbReading: integer("clb_reading"),
  clbSpeaking: integer("clb_speaking"),
  clbWriting: integer("clb_writing"),
  isVerified: boolean("is_verified").notNull().default(false),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const calibrationFixtures = pgTable("calibration_fixtures", {
  id: pkId(),
  orgId: orgId(),
  questionType: questionType("question_type").notNull(),
  questionPayload: jsonb("question_payload").notNull(),
  responseText: text("response_text"),
  responseAudioUrl: text("response_audio_url"),
  humanTraits: jsonb("human_traits").notNull(),
  source: calibrationSource("source").notNull(),
  clbAnchor: integer("clb_anchor"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export const skillWeights = pgTable("skill_weights", {
  id: pkId(),
  orgId: orgId(),
  questionType: questionType("question_type").notNull(),
  skill: skill("skill").notNull(),
  weightPct: numeric("weight_pct").notNull(),
  source: text("source").notNull(),
  methodNote: text("method_note"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const skillEstimates = pgTable("skill_estimates", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  skill: skill("skill").notNull(),
  estimatedScoreLow: integer("estimated_score_low").notNull(),
  estimatedScoreHigh: integer("estimated_score_high").notNull(),
  estimatedClb: integer("estimated_clb"),
  confidence: numeric("confidence"),
  attemptCount: integer("attempt_count").notNull().default(0),
  weightsVersion: text("weights_version"),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const typePerformance = pgTable("type_performance", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  questionType: questionType("question_type").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  avgScorePct: numeric("avg_score_pct"),
  priorityScore: numeric("priority_score"),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Operations                                                                 */
/* -------------------------------------------------------------------------- */

export const aiUsage = pgTable("ai_usage", {
  id: pkId(),
  orgId: orgId(),
  userId: uuid("user_id").references(() => users.id),
  attemptId: uuid("attempt_id").references(() => attempts.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  apiMode: aiApiMode("api_mode").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cachedTokens: integer("cached_tokens").notNull().default(0),
  costUsd: numeric("cost_usd").notNull().default("0"),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: pkId(),
  orgId: orgId(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: createdAt(),
});

export const scoreFlags = pgTable("score_flags", {
  id: pkId(),
  orgId: orgId(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  studentComment: text("student_comment"),
  status: scoreFlagStatus("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolutionNote: text("resolution_note"),
  createdAt: createdAt(),
});

export const systemSettings = pgTable(
  "system_settings",
  {
    orgId: orgId(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.key] })],
);
