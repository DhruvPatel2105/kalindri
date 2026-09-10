# Data Model

Postgres via Supabase (Canada Central). Drizzle ORM. Zod validation at every boundary.

**Revision 2** — adds `reported_real_scores` and `calibration_fixtures`, both required by
the validation strategy that research identified as a market differentiator.

**Every table carries `org_id`.** One organization exists at launch. This costs an hour now
and saves a painful week later.

---

## Design principles

1. **One `questions` table.** Type-specific data lives in `payload` (JSONB), validated by a
   per-type Zod schema. Never a table per question type.
2. **Everything is a session.** Practice, drill and mock are the same engine with different
   config. Mock mode is a feature flag, not a second application.
3. **Question snapshotting.** On submit, the question payload is copied into the attempt.
   Questions can be edited freely in place; history never breaks. No version table needed.
4. **Scores are per trait, not per attempt.** PTE scores traits separately and students see
   the breakdown.
5. **Raw model output always persisted**, separately from scores.

---

## Schema

### Tenancy and identity

```sql
organizations (
  id, name, slug, is_active, created_at
)

users (
  id, org_id, email UNIQUE, role,           -- 'student' | 'admin' | 'teacher' (reserved)
  full_name, is_active, notes,
  created_at, last_login_at
)
```

Auth via Supabase email/password. No self-signup — admin provisioning only.

### Session control and abuse detection

```sql
active_sessions (
  id, user_id, session_token, ip_address, user_agent,
  geo_country, geo_city, created_at, last_seen_at
)
-- Single active session enforced: new login invalidates prior row.

session_events (
  id, org_id, user_id, event_type,           -- 'login' | 'takeover' | 'geo_jump' | 'ua_change'
  ip_address, user_agent, geo_country,
  previous_ip, previous_geo, created_at
)

account_flags (
  id, org_id, user_id, reason, signal_data JSONB,
  status,                                     -- 'open' | 'reviewed' | 'dismissed'
  reviewed_by, reviewed_at, created_at
)
```

Nothing auto-blocks. Flags surface on an admin review panel for manual contact.

### Question bank

```sql
questions (
  id, org_id,
  external_id,                                -- 'WE-001', from the import sheet
  type,                                       -- enum, all 19 values from day one
  part,                                       -- 1 | 2 | 3
  payload JSONB,                              -- per-type, Zod-validated
  difficulty,                                 -- 'easy' | 'medium' | 'hard' (manual)
  derived_difficulty NUMERIC,                 -- computed from student performance
  tags TEXT[],                                -- unused in V1, present to avoid a migration
  accent,                                     -- 'en-CA' | 'en-GB' | 'en-US' | 'en-AU'
  audio_url, image_url,
  status,                                     -- 'draft' | 'review' | 'published'
  is_active BOOLEAN,                          -- instant disable, no delete
  source, source_notes,                       -- provenance
  is_seed_data BOOLEAN,                       -- synthetic test data, bulk-deletable
  created_at, updated_at
)

question_stats (
  question_id, attempt_count, avg_score_pct,
  flag_count, last_attempted_at
)
```

`is_active = false` removes a question from all pools instantly, including assembled mocks.
Past attempts remain valid because of snapshotting.

### Sessions, attempts, scores

```sql
sessions (
  id, org_id, user_id,
  mode,                                       -- 'practice' | 'drill' | 'mock'
  blueprint_id, mock_id,
  question_ids UUID[],                        -- resolved at session start
  current_item_index,
  state JSONB,                                -- autosaved; survives browser crash
  is_timed BOOLEAN,
  is_scored_for_analytics BOOLEAN,            -- exclude abandoned mocks
  status,                                     -- 'in_progress' | 'completed' | 'abandoned'
  started_at, completed_at
)

attempts (
  id, org_id, session_id, user_id, question_id,
  question_snapshot JSONB,                    -- payload as the student saw it
  response JSONB,                             -- text, selections, or audio ref
  audio_url,
  status,                                     -- 'abandoned' | 'submitted' | 'timed_out'
  counts_toward_stats BOOLEAN,                -- false for 'abandoned'
  time_taken_seconds,
  started_at, submitted_at
)

scores (
  id, attempt_id, trait, score, max_score,
  band_descriptor, feedback, positive_feedback,
  is_overridden BOOLEAN, overridden_by, override_reason,
  scorer_version, created_at
)

score_runs (
  id, attempt_id, scorer_type,                -- 'deterministic' | 'llm' | 'speech'
  model, prompt_version,
  raw_output JSONB,
  input_tokens, output_tokens, cached_tokens,
  cost_usd, latency_ms,
  status, error_message,
  created_at
)
```

**Attempt status rules.** Only `submitted` and `timed_out` count toward statistics.
`timed_out` counts because that is exactly what happens in the real exam. Abandoning
requires an explicit exit action; a closed tab is marked abandoned after 30 minutes idle.

### Mocks

```sql
mock_blueprints (
  id, org_id, name, part_config JSONB,        -- per-type min/max counts
  is_active
)

mocks (
  id, org_id, name, blueprint_id,
  build_type,                                 -- 'system' | 'admin_built'
  question_ids UUID[],
  is_public BOOLEAN,                          -- system mocks true; admin-built false
  created_by, created_at
)

mock_assignments (
  id, mock_id, user_id, assigned_by, assigned_at, completed_at
)
```

System mocks (five at launch) are public. Admin-built mocks are private and visible only to
assigned students.

### Calibration and validation

Research established that every competitor claims scoring accuracy with no published
evidence. A genuine validation study would be unique in this market, and it needs data
structures from day one.

```sql
reported_real_scores (
  id, org_id, user_id,
  test_date,
  listening, reading, speaking, writing,   -- official reported scores, 10-90
  overall,
  clb_listening, clb_reading, clb_speaking, clb_writing,
  is_verified BOOLEAN,                     -- score report seen by admin
  notes, created_at
)
-- The highest-value data in the system. Costs nothing to collect.
-- Enables published correlation and MAE per skill against platform estimates.

calibration_fixtures (
  id, question_type, question_payload JSONB,
  response_text, response_audio_url,
  human_traits JSONB,                      -- hand-scored, per trait
  source,                                  -- 'pearson_anchor' | 'hand_scored' | 'override'
  clb_anchor,                              -- for the official CLB 4/5/7 anchors
  created_by, created_at
)
-- Seeded with the two official Pearson anchor sets (Write Email,
-- Respond to a Situation, CLB 4/5/7), then grown by hand-scoring
-- and by admin score overrides.
```

### Analytics

```sql
skill_weights (
  id, question_type, skill,
  weight_pct NUMERIC,
  source,                                     -- 'derived_v1' | 'observed_v1' | …
  method_note TEXT,
  is_active BOOLEAN,
  updated_by, updated_at
)
-- Weights are DERIVED, not official. They live in the database, not in code, so they can
-- be corrected without a migration when better data arrives. Every row carries provenance,
-- and the app must expose a "how is this calculated?" explanation sourced from method_note.

real_score_reports (
  id, org_id, user_id,
  source,                                     -- 'pearson_scored_practice' | 'real_exam'
  listening, reading, speaking, writing,
  overall, test_date,
  linked_session_id,                          -- if responses were captured in-platform
  notes, created_at
)
-- Ground truth. Pearson's Scored Practice Test (~USD $35.99) uses the real scoring
-- algorithm and is the only purchasable source of genuine engine scores. Pairing these
-- with captured responses is what makes a published accuracy claim possible.

skill_estimates (
  id, user_id, skill,                         -- 'listening' | 'reading' | 'speaking' | 'writing'
  estimated_score_low, estimated_score_high,  -- a RANGE, never a point estimate
  estimated_clb,
  confidence, attempt_count,
  weights_version,                            -- which skill_weights set produced this
  computed_at
)

type_performance (
  id, user_id, question_type,
  attempt_count, avg_score_pct,
  priority_score,                             -- weight × headroom × confidence
  last_attempted_at, computed_at
)
```

### Operations

```sql
ai_usage (
  id, org_id, user_id, attempt_id,
  provider, model, api_mode,                  -- 'standard' | 'batch'
  input_tokens, output_tokens, cached_tokens,
  cost_usd, created_at
)

audit_log (
  id, org_id, actor_user_id, action,          -- 'impersonate' | 'score_override' |
  target_type, target_id,                     --   'deactivate_user' | 'delete_question' …
  details JSONB, ip_address, created_at
)

score_flags (
  id, attempt_id, user_id, student_comment,
  status,                                     -- 'open' | 'resolved' | 'dismissed'
  resolved_by, resolution_note, created_at
)

system_settings (
  key, value JSONB, updated_by, updated_at
)
-- monthly_spend_cap, ai_scoring_enabled (kill switch), notification_email
```

---

## Retention

| Data | Policy |
|---|---|
| Practice audio | Most recent **10 per task type per student**, rolling. 11th deletes oldest. |
| Mock audio | **90 days** |
| `score_runs` | Indefinite — needed for calibration and shadow re-scoring |
| `session_events` | 180 days |
| Attempts and scores | Indefinite |

**Audio format:** capture at 16kHz mono PCM, send that to Azure for pronunciation
assessment, then store a compressed Opus copy (~24kbps) for playback. Roughly one tenth the
size, indistinguishable for listening back.

Estimated storage at 50 students: ~300MB practice audio, ~750MB mock audio, ~1GB total
against Supabase Pro's 100GB.

---

## Backups

Supabase Pro: daily automated backups with point-in-time recovery. **Required before any
real student uses the platform.**

Additionally: a scheduled JSON export of the full question bank to a separate location.
Questions represent months of authoring work and deserve a second copy.

---

## Payload schemas

One Zod schema per type in `lib/questions/schemas/`. Field definitions are in
`01-question-types.md`.

Required across all content-scored types: **`key_points: string[]`**. AI content scoring
has nothing to score against without it.
