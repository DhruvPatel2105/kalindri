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

### Question sets (practice test engine)

```sql
question_sets (
  id, org_id,
  type,                                       -- one question type per set
  title, difficulty,                          -- difficulty nullable = unrated
  question_ids UUID[],                        -- ordered; questions stay in `questions`
  status,                                     -- 'draft' | 'review' | 'published'
  is_active, is_seed_data,
  created_at, updated_at
)
```

A set is what the browse page lists and what a student sits as one test. A practice-test
`sessions` row carries `question_set_id`, copies the set's ids into `question_ids`, and keeps
`state = { snapshots, answers }`: every question's payload as it was when the test started
(grading never re-reads `questions`) and the draft answers autosaved as the student moves
between questions. Questions the student never answered get no `attempts` row.

**Retries and history.** `sessions.retry_of_session_id` points a "practise incorrect
questions" session at the finished session whose not-fully-correct questions it repeats
(unique: one retry per session, so retries form a chain). Retry sessions have
`is_scored_for_analytics = false` and their attempts `counts_toward_stats = false`.
`sessions.result_summary` (JSONB) stores a finished test's roll-up (marks, correct / partial /
incorrect / unanswered counts) once every answer is marked; `attempts` and `scores` stay the
source of truth. Every test, retake and retry is its own `sessions` row and nothing updates a
finished session's attempts, so practice history is just these rows read back, newest first.

**Practice (learn) mode vs Test.** A question type offers two separate ways to work through a set:
*Test* (sit the whole set, submit, get a score — `sessions.mode = 'practice'`, everything above) and
*Practice* (all questions on one page, press Answer to reveal one question's answer, Try Again to
re-attempt — `sessions.mode = 'drill'`, one open session per student per set, no `session_type`). Practice
attempts are ordinary `attempts` rows (frozen question, version, scoring rules, `is_correct`), one per Answer
press and never overwritten, but with `counts_toward_stats = false` and `is_scored_for_analytics = false`.
Test history, dashboards, mastery and "Continue" all filter on test sessions, so Practice never appears in
them; a Practice-specific dashboard can be built later from the `drill` sessions.

**Retry journey identifiers.** Every practice session carries the three ids that describe where
it sits in a retry journey, plus its type and status:

| Spec name | Column | Meaning |
|---|---|---|
| `original_question_set_id` | `question_set_id` | The set that was originally sat; every session in a journey names the same one |
| `parent_session_id` | `retry_of_session_id` | The immediately previous session; null on a full practice |
| `root_session_id` | `root_session_id` | The first full practice of the journey; a full practice is its own root, a retry copies its parent's root |
| `session_type` | `session_type` | `FULL_PRACTICE` or `INCORRECT_PRACTICE` |
| `session_status` | `status` | `in_progress`, `completed` or `abandoned` |

Example: session 001 (full, parent null, root 001) → 002 (incorrect practice, parent 001, root 001)
→ 003 (incorrect practice, parent 002, root 001). CHECK constraints keep it consistent: a session
has a parent exactly when it is `INCORRECT_PRACTICE`, and a full practice's root is itself. A whole
journey is read with one query on `root_session_id`.

**Only `completed` sessions contribute to performance figures** (accuracy, scores, practice time,
trends). `abandoned` sessions are kept for operational history but are excluded from performance
and from the practice history list; `in_progress` ones appear in history only so they can be resumed.

**Question snapshots — history never changes when a question is edited.** When a test starts, every
question's payload (passage, options, and the answer key — for fill-in-the-blanks the expected answer
of every blank) is frozen into `sessions.state.snapshots`. When the test is submitted, every question
gets an `attempts` row carrying that frozen payload (`question_snapshot`), its `question_type` and
`question_version`, the student's answer (`response`, null if left blank) and `is_correct`. Answered
questions are `submitted`; questions left blank are `abandoned` (no response, `counts_toward_stats =
false`, not correct). Review and marks read these copies, never the live question, so editing a
question later (e.g. changing its correct answer) leaves every earlier report as it was. `questions.version`
starts at 1 and a database trigger adds 1 whenever `payload` changes, so each attempt records which
version it was taken against. Retrying re-reads the CURRENT question, as a new session with its own
snapshot.

**Indexes and duplicate guards** (migration 0009). Lookups: `active_sessions(user_id)` (every request),
`attempts(session_id)`, `sessions(user_id, started_at)`, `questions(org_id, type, status)`,
`question_sets(org_id, type, status)`. Guards: `scores(attempt_id, trait)` is unique (concurrent scoring
can't double-record a mark) and `sessions_one_open_per_set` allows one unfinished whole-set session per
(user, set, mode) — one open test and one open Practice — so a double click or a second tab resumes
the same session instead of creating another. Writers insert with ON CONFLICT DO NOTHING and re-read.

**Mixed tests and question rotation.** Each question type has one hidden "bank set" per org
(`question_sets.is_bank = true`, titled "Mixed test — <type>", at most one per type), mirroring the type's
published questions. A Mixed test is an ordinary test of that set, so sessions, attempts, results, retries,
history and dashboards all work unchanged — but its questions are chosen by rotation
(`lib/practice/rotation.ts`, shared by every question type): a student is never given a question they have
answered in the current round until they have answered every question in the bank; then a new round starts.
"Answered" is derived from existing data — `attempts` with `status = 'submitted'` and
`counts_toward_stats = true` (blank questions are 'abandoned'; retries and Practice never count) — so there is
no extra history table, and it persists across sessions and devices. Questions in a student's open tests are
reserved so two tests started together don't overlap, and a unique index gives one open test per set.
Bank sets are excluded from set lists, Practice and set building.

**Performance calculations** (practice dashboards). Only `completed` sessions count. Every percentage
goes through one helper (`percentOf`: rounded, `null` — never NaN — for an empty denominator) and is
**weighted**: it is built from summed counts (total correct ÷ total questions), never by averaging
per-session percentages.

- *Accuracy* = correct answers ÷ total questions × 100, where "correct" means full marks. Unanswered
  questions are in the total and count as not correct, as do partly correct ones.
- *Completion rate* = attempted questions ÷ total questions × 100 (answered, right or wrong).
- *Full-test performance* — completed `FULL_PRACTICE` sessions only: accuracy, completion rate,
  average score (total marks ÷ total available marks), session count.
- *Retry performance* — completed `INCORRECT_PRACTICE` sessions only, calculated separately. Retries are
  never part of full-test accuracy, the trend or improvement.
- *Full-test improvement* = the latest completed full test's accuracy minus the previous completed full
  test's, in percentage points (needs two; a test still awaiting a mark is skipped).
- *Question mastery* = of the unique questions a student has answered, the share whose LATEST completed,
  marked answer (full test or retry) was correct. A blank answer doesn't override an earlier result.
- *Practice time* adds full and retry sessions, each capped at 2 hours (active time isn't tracked yet).
  *Questions practised* = attempted questions across full tests and retries.

None of these is stored except the per-session roll-up in `sessions.result_summary`; accuracy and
completion rate are recomputed from its counts on read. `attempts.scoring_rules` records the scorer, the
rule in words and the scorer version an attempt was marked under, so a historical report can say how it was
marked if the rules change later. Marks-based "score" (which gives partial credit) is a separate figure.

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

## user_activity_days (admin time tracking)

One row per user per calendar day (America/Toronto): `seconds` of active time, `by_area` jsonb
(test / practice / review / other), `first_active_at`, `last_active_at`. Unique on (user_id, day).

- The browser (`ActivityTracker`) posts a heartbeat to `/api/activity` every 30 s, only while the tab is
  visible and the user touched the page within 180 s.
- The server credits the gap since that user's previous heartbeat if it is ≤ 90 s, otherwise 0
  (`recordHeartbeat`, one upsert). One timeline per user, so several tabs never double count; refreshes
  and navigation are seamless; closed/background tabs and long gaps add nothing.
- Limits: up to ~180 s of idle tail can be counted; the first heartbeat of a day credits 0; someone reading
  without touching the page for > 3 min stops counting.
- Read only by admin pages (org-scoped). Not used for scoring or student-facing views.
