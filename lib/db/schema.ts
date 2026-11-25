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
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { QUESTION_ACCENTS, QUESTION_DIFFICULTIES } from "@/lib/questions/enums";

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

export const questionDifficulty = pgEnum("question_difficulty", QUESTION_DIFFICULTIES);

export const questionAccent = pgEnum("question_accent", QUESTION_ACCENTS);

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

/**
 * What kind of practice a session is: the whole set (FULL_PRACTICE) or a
 * retry of just the questions an earlier session didn't get full marks on
 * (INCORRECT_PRACTICE).
 */
export const practiceSessionType = pgEnum("session_type", [
  "FULL_PRACTICE",
  "INCORRECT_PRACTICE",
]);

/** The colour a student bookmarked a question with. */
export const bookmarkColor = pgEnum("bookmark_color", [
  "red",
  "orange",
  "yellow",
  "green",
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
}).enableRLS();

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
}).enableRLS();

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
}, (table) => [
  // Read on every signed-in request (requireActiveSession).
  index("active_sessions_user_id_idx").on(table.userId),
]).enableRLS();

/**
 * Time a student actively spent in the app, one row per student per day (in
 * the app's activity time zone — see lib/activity/activity.ts). The browser
 * sends a heartbeat while the student is really using the app; the server
 * credits the time since that student's PREVIOUS heartbeat (capped), so the
 * total follows the wall clock and two open tabs can't count the same minute
 * twice. `by_area` splits the day's seconds by what they were doing
 * (test / practice / review / other).
 */
export const userActivityDays = pgTable(
  "user_activity_days",
  {
    id: pkId(),
    orgId: orgId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    day: date("day").notNull(),
    seconds: integer("seconds").notNull().default(0),
    byArea: jsonb("by_area").notNull().default({}),
    firstActiveAt: timestamp("first_active_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_activity_days_user_day_unique").on(table.userId, table.day),
    index("user_activity_days_org_day_idx").on(table.orgId, table.day),
  ],
).enableRLS();

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
  geoCity: text("geo_city"),
  previousIp: text("previous_ip"),
  previousGeo: text("previous_geo"),
  createdAt: createdAt(),
}).enableRLS();

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
}).enableRLS();

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
  /**
   * Starts at 1 and goes up by one whenever `payload` changes (a database
   * trigger does this, so it holds for edits from anywhere). Attempts record
   * the version they were taken against; the content itself is frozen in the
   * session and attempt snapshots, so a later edit never changes history.
   */
  version: integer("version").notNull().default(1),
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
}, (table) => [
  // Practice lists, set building and library counts filter on these.
  index("questions_org_type_status_idx").on(table.orgId, table.type, table.status),
]).enableRLS();

/**
 * An ordered group of questions of ONE type that a student sits as a single
 * test (practice test engine). Questions stay in the one `questions` table
 * (CLAUDE.md #1); a set only references them, in order, by id.
 *
 * `question_ids` is an array rather than a join table to match
 * `sessions.question_ids` / `mocks.question_ids`. Nothing in the database
 * enforces that every id exists or is the right type, so the set-building
 * script (lib/db/createQuestionSets.ts) validates that when it writes one,
 * and the engine re-checks each question is published and active at start.
 */
export const questionSets = pgTable("question_sets", {
  id: pkId(),
  orgId: orgId(),
  type: questionType("type").notNull(),
  title: text("title").notNull(),
  difficulty: questionDifficulty("difficulty"),
  questionIds: uuid("question_ids").array().notNull(),
  status: questionStatus("status").notNull().default("draft"),
  isActive: boolean("is_active").notNull().default(true),
  isSeedData: boolean("is_seed_data").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /**
   * True for the one system "Mixed test" set per org and question type: a
   * test of it draws its questions from ALL the type's published questions
   * with rotation (lib/practice/rotation.ts), so it is hidden from the set
   * lists and from set building. Its question_ids mirror the type's bank.
   */
  isBank: boolean("is_bank").notNull().default(false),
}, (table) => [
  index("question_sets_org_type_status_idx").on(table.orgId, table.type, table.status),
  // At most one bank set per org and type.
  uniqueIndex("question_sets_one_bank_per_type")
    .on(table.orgId, table.type)
    .where(sql`${table.isBank}`),
]).enableRLS();

/**
 * A student's bookmark on a question: one colour per (student, question),
 * changed in place or removed. It belongs to the question, not to any session,
 * so it shows wherever the question appears. Content is never copied here.
 */
export const questionBookmarks = pgTable(
  "question_bookmarks",
  {
    id: pkId(),
    orgId: orgId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    color: bookmarkColor("color").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("question_bookmarks_user_question_unique").on(
      table.userId,
      table.questionId,
    ),
  ],
).enableRLS();

export const questionStats = pgTable("question_stats", {
  questionId: uuid("question_id")
    .primaryKey()
    .references(() => questions.id),
  orgId: orgId(),
  attemptCount: integer("attempt_count").notNull().default(0),
  avgScorePct: numeric("avg_score_pct"),
  flagCount: integer("flag_count").notNull().default(0),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
}).enableRLS();

/* -------------------------------------------------------------------------- */
/*  Mocks (referenced by sessions)                                             */
/* -------------------------------------------------------------------------- */

export const mockBlueprints = pgTable("mock_blueprints", {
  id: pkId(),
  orgId: orgId(),
  name: text("name").notNull(),
  partConfig: jsonb("part_config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
  /**
   * The ORIGINAL question set being sat (the spec's original_question_set_id),
   * for practice-test sessions (null otherwise). A retry keeps its original's
   * set, so every session in a retry journey names the same set.
   */
  questionSetId: uuid("question_set_id").references(() => questionSets.id),
  /**
   * The spec's parent_session_id: the immediately previous session in a retry
   * journey — the finished session whose not-fully-correct questions this one
   * repeats. Null on a full practice. Retries chain (retry of a retry); a
   * session has at most one retry (unique index).
   */
  retryOfSessionId: uuid("retry_of_session_id").references(
    (): AnyPgColumn => sessions.id,
  ),
  /**
   * The first full practice session of the retry journey this session belongs
   * to. On a full practice it is the session's own id; on a retry it is the
   * parent's root. Lets a whole journey be read with one query. Null on
   * sessions that aren't practice tests.
   */
  rootSessionId: uuid("root_session_id").references(
    (): AnyPgColumn => sessions.id,
  ),
  /** FULL_PRACTICE or INCORRECT_PRACTICE; null on sessions that aren't practice tests. */
  sessionType: practiceSessionType("session_type"),
  questionIds: uuid("question_ids").array(),
  currentItemIndex: integer("current_item_index").notNull().default(0),
  state: jsonb("state"),
  /**
   * A finished practice test's result roll-up (see lib/practice/testResults.ts
   * TestSummary): written once every answer has been marked, so history and
   * future analytics can read it without re-scoring. The attempts and scores
   * rows remain the source of truth; this is a stored copy of the sum.
   */
  resultSummary: jsonb("result_summary"),
  isTimed: boolean("is_timed").notNull().default(true),
  isScoredForAnalytics: boolean("is_scored_for_analytics")
    .notNull()
    .default(true),
  status: sessionStatus("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("sessions_retry_of_session_id_unique").on(table.retryOfSessionId),
  index("sessions_root_session_id_idx").on(table.rootSessionId),
  // History and dashboards: a student's sessions, newest first.
  index("sessions_user_started_idx").on(table.userId, table.startedAt),
  // At most ONE unfinished whole-set session per student, set and mode (one
  // open test, one open Practice). Stops a double click or a second tab from
  // starting two; also serves the "resume my open test" lookup.
  uniqueIndex("sessions_one_open_per_set")
    .on(table.userId, table.questionSetId, table.mode)
    .where(
      sql`${table.status} = 'in_progress' AND ${table.retryOfSessionId} IS NULL AND ${table.questionSetId} IS NOT NULL`,
    ),
  // A retry has a parent and a full practice has none.
  check(
    "sessions_type_matches_parent",
    sql`${table.sessionType} IS NULL OR (${table.sessionType} = 'FULL_PRACTICE') = (${table.retryOfSessionId} IS NULL)`,
  ),
  // A full practice is its own root.
  check(
    "sessions_full_practice_is_own_root",
    sql`${table.retryOfSessionId} IS NOT NULL OR ${table.rootSessionId} IS NULL OR ${table.rootSessionId} = ${table.id}`,
  ),
]).enableRLS();

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
  /**
   * The question payload exactly as the student saw it — passage, options and
   * the answer key (for fill-in-the-blanks, the expected answer of every
   * blank). Frozen when the test starts and copied here at submit, so editing
   * the question later never changes this attempt's review or marks.
   */
  questionSnapshot: jsonb("question_snapshot").notNull(),
  /** The question's type and version when it was sat (null on attempts saved before these were recorded). */
  questionType: questionType("question_type"),
  questionVersion: integer("question_version"),
  /**
   * The student's answer, as submitted; null when the question was left blank.
   * Every question in a submitted practice test has an attempt row: answered
   * ones are 'submitted', blank ones 'abandoned' with no response and
   * counts_toward_stats = false.
   */
  response: jsonb("response"),
  /** Full marks? Set when the attempt is scored; null until then (and for blank questions: false). */
  isCorrect: boolean("is_correct"),
  /**
   * The scoring rules the attempt was marked under (scorer, plain-words rule,
   * scorer version — see lib/practice/scoringRules.ts), saved at submit so a
   * historical report can still say how it was marked if the rules change.
   * Null on attempts saved before this was recorded, and on types not scored
   * deterministically.
   */
  scoringRules: jsonb("scoring_rules"),
  audioUrl: text("audio_url"),
  status: attemptStatus("status").notNull(),
  countsTowardStats: boolean("counts_toward_stats").notNull().default(false),
  timeTakenSeconds: integer("time_taken_seconds"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (table) => [
  // Question mastery reads a student's attempts grouped by question.
  index("attempts_user_question_idx").on(table.userId, table.questionId),
  // Results, review and scoring read a session's attempts.
  index("attempts_session_id_idx").on(table.sessionId),
]).enableRLS();

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
}, (table) => [
  // One score per trait per attempt: concurrent scoring can't double-record,
  // and results join scores by attempt.
  uniqueIndex("scores_attempt_trait_unique").on(table.attemptId, table.trait),
]).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
).enableRLS();
