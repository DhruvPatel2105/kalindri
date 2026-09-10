# Build Roadmap

**Revision 2** — calibration expanded into a validation strategy; speaking regression
testing added; weight-model derivation added to Phase 6.

Solo, full-time, Claude Code. Big-bang release: all modules ship together, but built in
sequence.

**Every module ships behind an `is_active` flag.** Develop against all four, flip them on
together.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | One repo, one deploy |
| Database / Auth / Storage | Supabase Pro, Canada Central | One service; backups included |
| ORM | Drizzle + Zod | Type safety Claude Code can't quietly break |
| UI | Tailwind + shadcn/ui | Well-known to Claude Code |
| LLM | Anthropic API (standard + Batch) | Batch gives 50% off mock scoring |
| Speech | Azure Speech | Pronunciation assessment **and** TTS — one vendor |
| Grammar | LanguageTool, self-hosted | Free, unlimited |
| Email | Resend | Mock reports, free at this volume |
| Errors | Sentry | Highest-value addition for a solo builder |
| Analytics | Plausible or Umami | Privacy-friendly |
| Hosting | Vercel Pro | Free tier fine during development |

**One vendor decision worth restating:** Azure handles both TTS and pronunciation
assessment. Cutting an entire vendor integration out of a solo project is worth more than
a marginal voice-quality difference.

---

## Phase 0 — Foundation

Nothing here is visible to a student. Skipping it means rewriting everything at Phase 4.

1. Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui + Drizzle + Supabase auth.
   Email/password only, no self-signup.
2. Full schema from `03-data-model.md`. All tables including `org_id` everywhere. Seed one
   organization.
3. Question type registry: enum of all 19 types, Zod payload schemas for all 19.
4. Session control: single active session enforced server-side, `session_events` logging,
   flag generation.
5. Admin shell: layout, auth guard, empty pages.
6. User management: create with auto-generated password, copy-credentials button,
   deactivate, reset, impersonate with audit logging.
7. Sentry, Plausible, Resend wired up.
8. **Seed data generator** — realistic synthetic questions for all 19 types, marked
   `is_seed_data`, bulk-deletable in one action.

**Exit criteria:** admin can create a student, that student can log in, a second login
kicks the first session, and the event appears on the admin flag panel.

---

## Phase 1 — Scoring infrastructure

Built before any module, because all four depend on it.

9. Scorer registry (`lib/scoring/registry.ts`) mapping type → scorer function.
10. Deterministic layer: normalisation, word count, spelling (nspell, four dictionaries),
    grammar (self-hosted LanguageTool). **Unit tested.**
11. Queued scoring jobs with retries, rate limiting, cost logging to `ai_usage`, raw output
    to `score_runs`.
12. LLM scorer harness: prompt versioning (immutable), prompt caching with static block
    first, temperature 0, Zod-validated JSON output, hard token caps.
13. Batch API path for mock scoring, alongside the standard path for practice.
14. Global spend kill switch and threshold alerting.
15. Duplicate response caching by text hash.

**Exit criteria:** a fake attempt scores end to end, cost appears in `ai_usage`, raw output
in `score_runs`, and a forced API failure retries cleanly.

---

## Phase 2 — Writing module

The hardest scoring problem, with the simplest UI. Solve it first.

16. Session engine: create session, render item, autosave every 5s, submit on timer expiry
    or manual submit. This engine also runs drills and mocks later.
17. Write Email component: scenario and bullets left, textarea right, live word counter
    (amber outside 50–120), paste disabled.
18. Write Email scorer: Content/Form gate first, then the remaining five traits. Official
    band descriptors plus the **three official Pearson anchors (CLB 4, 5, 7)** from the
    Core score guide, loaded into `calibration_fixtures` as `source='pearson_anchor'`.
19. Results screen per `04-ux-spec.md` §6.
20. Summarize Written Text: component, scorer (Content/Form/Grammar/Vocabulary, no
    spelling trait), results.
21. Deep analysis on-demand button.

**→ Deploy to private staging. Give 2–3 students access. Start collecting real answers.**
This is not a release. It is how you get answers to calibrate against.

---

## Phase 3 — Reading module

Zero API cost, five types, fast progress.

22. R&W Fill in the Blanks (dropdown), Reading FIB (drag and drop).
23. MCQ single and multiple — **with negative marking, floored at 0**.
24. Reorder Paragraph — **adjacent-pair scoring**. N boxes = max N−1.
25. Instant results, no queue needed.
26. Drill mode: run lengths per type, results at end.

**Exit criteria:** deterministic scorer unit tests pass, including negative marking and
adjacent-pair edge cases.

---

## Phase 4 — Listening module

27. Azure TTS integration and bulk audio generation from the admin panel.
28. Audio player component: play-once enforcement, countdown, no scrubbing.
29. Write from Dictation, Listening FIB — word-by-word spelling-sensitive scoring.
30. Select Missing Word — beep appended programmatically.
31. Highlight Incorrect Words — click-to-select, negative marking.
32. MCQ single and multiple.
33. Summarize Spoken Text — LLM scored, 20–30 words, stricter spelling banding.

**Note:** one clean transcript column generates the audio, the on-screen text and the
answer key for four of these types. Author transcripts, not audio.

---

## Phase 5 — Speaking module

Roughly as much work as the other three combined.

34. Microphone capture: permission handling, MediaRecorder, 16kHz mono PCM, chunked upload,
    failure states.
35. Dual storage: PCM to Azure for assessment, Opus copy for playback.
36. Azure Pronunciation Assessment: scripted mode (Read Aloud, Repeat Sentence) and
    unscripted mode (Describe Image, Respond to a Situation).
36a. **Robotic-reading regression test.** Fixture set containing a deliberately
    word-by-word reading and a natural connected reading of the same passage. The natural
    reading **must** score higher on fluency. This is a required test, not optional — a
    major competitor's scoring fails it and consequently teaches students a habit that
    lowers their real exam score. Include prosody in the fluency computation.
37. Read Aloud: word-level error counting, pronunciation, fluency. **No LLM.**
    Note: Read Aloud contributes to **Reading and Speaking in Core** — PTE Academic dropped
    the Reading contribution in Aug 2025, which does not apply here.
38. Repeat Sentence: transcript comparison, 0–3 content bands. **No LLM.**
39. Answer Short Question: normalised transcript against accepted variants. **No LLM.**
40. Describe Image and Respond to a Situation: LLM content/appropriacy plus Azure delivery.
    Respond to a Situation has **three official Pearson anchors (CLB 4, 5, 7)** with audio
    and commentary — load them as fixtures. Describe Image has none.
41. Speaking results screen with word-level colouring and audio playback.
42. Audio retention: rolling 10 per type per student; 90 days for mock audio.

---

## Phase 6 — Analytics and recommendations

43. **Derived weight model.** Compute cross-skill weights from official question counts ×
    rubric maximums (see `02-scoring-spec.md` §10). Version the model. Do **not** use the
    originally supplied percentage table — research established it is unverifiable and no
    PTE Core version exists in any source.
44. Skill estimation producing a **CLB band plus a score range**, never a point value, with
    confidence thresholds.
44. CLB conversion and blocking-skill identification.
45. Recommendation engine: `weight × (1 − accuracy) × confidence`, blocking-skill only,
    5-attempt minimum before ranking.
46. Student dashboard, progress screen, writing error breakdown.
47. Admin analytics: cohort table, at-risk view, spend trends, question stats.

---

## Phase 7 — Mock tests

Assembly of things that already work.

48. Blueprint engine using the official 52–67 item structure.
49. Five system mocks assembled from the pool.
50. Admin mock builder with live count validation and "fill remaining randomly".
51. Mock assignment to named students.
52. Mic and audio check screen.
53. Mock runner: enforced section timers, auto-advance, no pause, crash-resume, progress
    indicator.
54. Batch scoring on submit, deep analysis by default.
55. Report screen and Resend email delivery.

---

## Phase 8 — Calibration and release

**Start step 56 during Phase 2, not here.** Buying and sitting Scored Practice Tests takes
calendar time and the results shape every scoring prompt you write.

56. **Buy 3–5 Pearson Scored Practice Tests (~USD $35.99 each).** These use the real PTE
    Core scoring algorithm. Have staging students sit them and share both their responses
    and the official score report. Store in `real_score_reports`. This is the only
    purchasable source of genuine Pearson-engine ground truth.
57. **Hand-score 10 answers per LLM-scored type (~50 total).** Prioritise SWT, SST and
    Describe Image — these have **no official anchors anywhere**. Write Email and Respond
    to a Situation already have official CLB 4/5/7 anchors with Pearson commentary.
58. Calibration harness reporting mean absolute error per trait, covering **speaking as well
    as writing**. Run after every prompt change; an MAE increase is a regression regardless
    of how good the feedback reads.
59. **Speaking-specific regression test: natural connected speech must score higher than
    deliberate word-by-word delivery.** APEUni's most damaging documented flaw is teaching
    students to read robotically. Assert against it.
60. Tune prompts against the harness.
61. Score flagging and admin override flow.
62. Populate `skill_weights` with the derived model; verify the in-app derivation
    disclosure renders.
63. Load real question bank; delete seed data.
64. Verify backups and point-in-time recovery.
65. Two weeks of staging use without a blocker.
66. **Optional but high value:** publish your measured correlation and MAE against the real
    score reports. No competitor has done this.

---

## V1 release checklist

- [ ] All 19 question types render and score correctly
- [ ] Question bank meets minimum volume per type
- [ ] Five mocks assembled, each completed end to end at least once
- [ ] Scoring validated against the hand-scored calibration set, MAE acceptable per trait
- [ ] Robotic-reading regression test passing
- [ ] All estimates labelled; no unlabelled 10–90 figure anywhere in the UI
- [ ] Weight model versioned and documented as a derivation, not an official figure
- [ ] At least 3 real Pearson score reports collected and compared against our estimates
- [ ] Speaking scorer verified to reward natural speech over word-by-word delivery
- [ ] Estimated skill scores presented as **ranges with CLB bands**, never point estimates
- [ ] Weight derivation disclosure visible wherever task-impact percentages appear
- [ ] Blocking-skill recommendation engine live
- [ ] Admin panel complete: users, questions, mocks, monitoring, overrides
- [ ] Single active session and sharing alerts working
- [ ] Supabase Pro backups running and restore tested
- [ ] Sentry live, no unresolved errors
- [ ] Mock report email delivering
- [ ] 2–3 staging students, two weeks, no blockers

---

## Working with Claude Code

**Keep prompts small.** "Build the Write Email scorer" is fine. "Build the writing module"
produces something that looks finished and is subtly wrong in five places.

**Use plan mode** (Shift+Tab twice) for anything non-trivial. Read the plan before
approving.

**One phase per branch, small commits.**

**Demand tests on deterministic scorers.** They are easy to test and the tests catch real
bugs — particularly negative marking and adjacent-pair scoring.

**The failure mode to guard against** is not bad code. It is plausible code you cannot
evaluate. The calibration harness is the only real defence on the scoring side; unit tests
are the defence everywhere else.
