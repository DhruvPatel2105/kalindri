import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

/**
 * These tests pin the schema to `docs/03-data-model.md`. They read the Drizzle
 * table definitions directly (no database) and assert:
 *   - every specified table exists, and no extras
 *   - every specified column exists on each table
 *   - the question-type enum has exactly the 19 PTE Core values
 *   - `org_id` is present on every table except `organizations`
 */

/** The 19 PTE Core question types, in `CLAUDE.md` order. */
const QUESTION_TYPES = [
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "DESCRIBE_IMAGE",
  "RESPOND_TO_SITUATION",
  "ANSWER_SHORT_QUESTION",
  "SUMMARIZE_WRITTEN_TEXT",
  "WRITE_EMAIL",
  "FIB_RW",
  "MCM_READING",
  "REORDER_PARAGRAPH",
  "FIB_READING",
  "MCS_READING",
  "SUMMARIZE_SPOKEN_TEXT",
  "MCM_LISTENING",
  "FIB_LISTENING",
  "MCS_LISTENING",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "WRITE_FROM_DICTATION",
] as const;

/** table name -> columns that must exist (per the spec's column sketches, plus org_id). */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  organizations: ["id", "name", "slug", "is_active", "created_at"],
  users: [
    "id", "org_id", "email", "role", "full_name", "is_active", "notes",
    "created_at", "last_login_at",
  ],
  active_sessions: [
    "id", "org_id", "user_id", "session_token", "ip_address", "user_agent",
    "geo_country", "geo_city", "created_at", "last_seen_at",
  ],
  session_events: [
    "id", "org_id", "user_id", "event_type", "ip_address", "user_agent",
    "geo_country", "previous_ip", "previous_geo", "created_at",
  ],
  account_flags: [
    "id", "org_id", "user_id", "reason", "signal_data", "status",
    "reviewed_by", "reviewed_at", "created_at",
  ],
  questions: [
    "id", "org_id", "external_id", "type", "part", "payload", "difficulty",
    "derived_difficulty", "tags", "accent", "audio_url", "image_url", "status",
    "is_active", "source", "source_notes", "is_seed_data", "created_at",
    "updated_at",
  ],
  question_stats: [
    "question_id", "org_id", "attempt_count", "avg_score_pct", "flag_count",
    "last_attempted_at",
  ],
  sessions: [
    "id", "org_id", "user_id", "mode", "blueprint_id", "mock_id",
    "question_ids", "current_item_index", "state", "is_timed",
    "is_scored_for_analytics", "status", "started_at", "completed_at",
  ],
  attempts: [
    "id", "org_id", "session_id", "user_id", "question_id", "question_snapshot",
    "response", "audio_url", "status", "counts_toward_stats",
    "time_taken_seconds", "started_at", "submitted_at",
  ],
  scores: [
    "id", "org_id", "attempt_id", "trait", "score", "max_score",
    "band_descriptor", "feedback", "positive_feedback", "is_overridden",
    "overridden_by", "override_reason", "scorer_version", "created_at",
  ],
  score_runs: [
    "id", "org_id", "attempt_id", "scorer_type", "model", "prompt_version",
    "raw_output", "input_tokens", "output_tokens", "cached_tokens", "cost_usd",
    "latency_ms", "status", "error_message", "created_at",
  ],
  mock_blueprints: ["id", "org_id", "name", "part_config", "is_active"],
  mocks: [
    "id", "org_id", "name", "blueprint_id", "build_type", "question_ids",
    "is_public", "created_by", "created_at",
  ],
  mock_assignments: [
    "id", "org_id", "mock_id", "user_id", "assigned_by", "assigned_at",
    "completed_at",
  ],
  skill_weights: [
    "id", "org_id", "question_type", "skill", "weight_pct", "source",
    "method_note", "is_active", "updated_by", "updated_at",
  ],
  skill_estimates: [
    "id", "org_id", "user_id", "skill", "estimated_score_low",
    "estimated_score_high", "estimated_clb", "confidence", "attempt_count",
    "weights_version", "computed_at",
  ],
  type_performance: [
    "id", "org_id", "user_id", "question_type", "attempt_count",
    "avg_score_pct", "priority_score", "last_attempted_at", "computed_at",
  ],
  ai_usage: [
    "id", "org_id", "user_id", "attempt_id", "provider", "model", "api_mode",
    "input_tokens", "output_tokens", "cached_tokens", "cost_usd", "created_at",
  ],
  audit_log: [
    "id", "org_id", "actor_user_id", "action", "target_type", "target_id",
    "details", "ip_address", "created_at",
  ],
  score_flags: [
    "id", "org_id", "attempt_id", "user_id", "student_comment", "status",
    "resolved_by", "resolution_note", "created_at",
  ],
  system_settings: ["org_id", "key", "value", "updated_by", "updated_at"],
  reported_real_scores: [
    "id", "org_id", "user_id", "test_date", "listening", "reading", "speaking",
    "writing", "overall", "clb_listening", "clb_reading", "clb_speaking",
    "clb_writing", "is_verified", "notes", "created_at",
  ],
  calibration_fixtures: [
    "id", "org_id", "question_type", "question_payload", "response_text",
    "response_audio_url", "human_traits", "source", "clb_anchor", "created_by",
    "created_at",
  ],
};

const EXPECTED_TABLE_NAMES = Object.keys(EXPECTED_COLUMNS).sort();

/** Every exported Drizzle table, keyed by its SQL name. */
const tablesByName = new Map<string, PgTable>();
for (const value of Object.values(schema)) {
  if (is(value, PgTable)) {
    tablesByName.set(getTableConfig(value).name, value);
  }
}

function columnNames(table: PgTable): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("table presence", () => {
  it("defines exactly the tables in the spec", () => {
    expect([...tablesByName.keys()].sort()).toEqual(EXPECTED_TABLE_NAMES);
  });

  it("defines all 23 tables", () => {
    expect(tablesByName.size).toBe(23);
  });
});

describe("required columns", () => {
  for (const [tableName, expectedColumns] of Object.entries(EXPECTED_COLUMNS)) {
    it(`${tableName} has every specified column`, () => {
      const table = tablesByName.get(tableName);
      expect(table, `table ${tableName} is missing`).toBeDefined();
      const actual = new Set(columnNames(table as PgTable));
      for (const column of expectedColumns) {
        expect(actual.has(column), `${tableName}.${column} is missing`).toBe(
          true,
        );
      }
    });
  }
});

describe("question_type enum", () => {
  it("has exactly the 19 PTE Core values, in order", () => {
    expect(schema.questionType.enumValues).toEqual([...QUESTION_TYPES]);
  });

  it("has 19 values", () => {
    expect(schema.questionType.enumValues).toHaveLength(19);
  });

  it("is the column type on every table that stores a question type", () => {
    for (const tableName of [
      "questions",
      "skill_weights",
      "type_performance",
      "calibration_fixtures",
    ]) {
      const table = tablesByName.get(tableName);
      const column = getTableConfig(table as PgTable).columns.find((c) =>
        c.name === "type" || c.name === "question_type",
      );
      expect(column, `${tableName} question-type column`).toBeDefined();
      expect((column as { enumValues?: string[] }).enumValues).toEqual([
        ...QUESTION_TYPES,
      ]);
    }
  });
});

describe("org_id", () => {
  it("is present on every table except organizations", () => {
    for (const [tableName, table] of tablesByName) {
      const hasOrgId = columnNames(table).includes("org_id");
      if (tableName === "organizations") {
        expect(hasOrgId, "organizations must not have org_id").toBe(false);
      } else {
        expect(hasOrgId, `${tableName} is missing org_id`).toBe(true);
      }
    }
  });

  it("makes org_id NOT NULL wherever it exists", () => {
    for (const [tableName, table] of tablesByName) {
      if (tableName === "organizations") continue;
      const orgId = getTableConfig(table).columns.find(
        (c) => c.name === "org_id",
      );
      expect(orgId?.notNull, `${tableName}.org_id should be NOT NULL`).toBe(
        true,
      );
    }
  });
});
