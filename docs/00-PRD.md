# Kalindri — Product Requirements Document

**Version:** 2.0 (revised after independent research verification)
**Status:** Complete, pending two open items (§13)
**Last updated:** 7 September 2026

---

## 1. What this is

Kalindri is an unofficial practice and AI-scoring platform for **PTE Core**, Pearson's
English test used for Canadian economic immigration.

Students practise individual question types and sit full timed mock tests. Responses are
scored automatically — deterministically where the exam allows it, by AI where it does not
— and returned with trait-level feedback that names what to fix.

Not affiliated with, endorsed by, or connected to Pearson.

## 2. Who it's for

**Primary user: the student.** Adults preparing for Canadian PR through Express Entry.
Globally distributed, concentrated in Canada and India. Nearly all target **CLB 9**, the
competitive Express Entry threshold. They are under real deadline pressure with money and
immigration outcomes at stake.

**Secondary user: the admin.** Provisions accounts, manages the question bank, builds
mocks, monitors spend and progress, handles support.

**Deferred to V2: teacher/institute role.** Reserved in the schema, no UI in V1.

## 3. The problem

IRCC does not average PTE Core skill scores. **A candidate's Canadian Language Benchmark is
set by their lowest single skill.** Three skills at CLB 9 and one at CLB 7 makes them
CLB 7.

Writing is usually the blocking skill, because CLB 9 Writing is compressed into 88–89 at
the very top of the scale, while Speaking spans a wider 84–88.

Existing platforms report an overall score or four separate numbers. **Competitive research
confirmed that none identifies which skill is blocking the user's CLB, and none recommends
practice by cross-skill impact.** Students consequently drill question types worth ~1% of a
skill score while ignoring types worth ~30%.

## 4. The core proposition

Four pillars, in priority order. All four were validated as genuine market gaps.

**1. Blocking-skill identification.** The dashboard headline is not a score. It is
*"Writing is holding you at CLB 8. You need 88, you're at 79."*

Research verdict: no competitor delivers a dynamic per-user diagnosis. The closest is
ptecorepractice.com, which pairs a per-skill CLB calculator with static editorial advice to
"always prioritize the lowest-skill score" — but its own pricing table labels this a
"Static target plan," i.e. generic content, not a per-user engine. **This is a real gap and
a rival is one iteration from occupying it. Ship it first, make it dynamic and quantified.**

**2. Impact-weighted practice recommendations.** Priority is
`derived_weight × (1 − accuracy) × confidence`, optimised for the blocking skill only.
This surfaces counter-intuitive but correct advice: a student whose *Reading* is blocking
may need to practise *Read Aloud*, a Speaking task contributing ~30% of the Reading score.

Research verdict: essentially unbuilt. The concept appears in blog content across several
platforms, but none turns it into a personalised recommender.

**3. Trustworthy speaking scoring.** Research identified speaking-score unreliability as the
single most cited failure across every competitor. APEUni is widely reported to under-score
fluency by 10–30 points and — critically — to reward reading **one word at a time**, which
teaches a habit that lowers real exam scores. Scoring that does not punish natural connected
speech is a differentiator on its own.

**4. Provable calibration.** Every rival claims accuracy with no evidence: AlfaPTE's "up to
about 95%", Gurully's "±5 points" and "95% across 144,420 attempts" are self-reported
marketing with no published methodology. Only Pearson's own product uses the real engine.
**Publishing a genuine validation study would be unique in this market.**

## 5. Competitive position

| Platform | Blocking-skill ID | Cross-skill recs | Notable weakness |
|---|---|---|---|
| AlfaPTE | No | No (shows module contribution) | Speaking sometimes unscored; unverified 95% claim |
| APEUni | No | Explains concept only | Under-scores speaking 10–30 pts; rewards word-by-word reading |
| Gurully | No | No | Feedback "vague"; mismatched audio; zero-refund policy |
| ptecorepractice.com | Closest — static plan | Closest — static content | Core-only, small, unverified |
| PTE Tutorials | No | No | App reliability failures |
| PTE Magic | No | No | No validation |
| **Pearson Official AI Practice** | No | No | **Uses the real engine.** $35.99 one-off |

**The honest benchmark is Pearson's own product**, not AlfaPTE. It uses the genuine KAT/LSA
scoring engine and includes a 300-question Core question bank with model answers for a
one-time fee. You cannot out-calibrate it. You can beat it on price, on breadth of practice,
on blocking-skill diagnosis and on cross-skill recommendations, none of which it does.

## 6. Success criteria for V1

Ten students who find the platform genuinely improves their preparation efficiency.
Not revenue, not user count.

## 7. Scope

### In scope for V1

- All **19 PTE Core question types**, fully implemented and scored
- Three practice modes: **standard**, **drill**, **mock**
- Five system mocks plus admin-built mocks assignable to named students
- Estimated per-skill CLB bands and blocking-skill analysis
- Impact-weighted recommendations
- Full progress tracking and admin analytics
- Admin panel: users, question bank, mock builder, monitoring, score overrides
- **"Report your real exam score"** capture for calibration

### Explicitly out of scope for V1

Student self-signup · Google sign-in · payments · teacher role UI · batch management ·
device fingerprinting · mobile for Writing and Speaking · Firefox and Safari · student data
export/deletion · in-app tutorial · synonym matching · spelling-consistency penalties ·
Pearson disclaimer and privacy policy *(deferred at client decision, against recommendation
— §12)*

## 8. Users, roles and access

Provisioning is manual; no self-signup. Admin creates each account with an auto-generated
password and delivers credentials directly.

**Roles:** `student`, `admin` active. `teacher` reserved.
**Password reset:** admin-performed, regenerate-and-copy.
**Deactivation:** disables login, preserves history.
**Impersonation:** available to admin, fully audit-logged.

### Access control

- **Single active session per account**, enforced server-side
- **No device fingerprinting in V1**
- **Sharing detection** via session takeover count, IP/geolocation jumps, login frequency,
  user-agent changes, logged to `session_events`
- Flagged accounts appear on an admin review panel. **Nothing auto-blocks.**
- Student email watermarked on question screens

## 9. Commercial model

Admin absorbs infrastructure cost in V1 and invoices the institute separately. The institute
is non-technical and does not see the infrastructure. Students never pay directly.

`organizations` exists from day one with one row; every table carries `org_id`. Per-institute
billing and multi-institute licensing become configuration, not migration.

**Research note on commercial terms.** Gurully's zero-refund policy, account deactivation
after a negative review, and requests to delete reviews in exchange for refunds are
documented reputational failures. If billing is ever student-facing, transparent refunds and
no auto-renew traps are an explicit marketing advantage.

## 10. Practice limits

**None.** Protected by duplicate response caching, burst rate limiting (~10 submissions per
minute), per-call cost logging in `ai_usage`, and a global spend kill switch.

## 11. Constraints and budget

Solo, full-time, Claude Code. No fixed deadline; quality over speed. Big-bang release with
private staging from the moment Writing works.

### Expected monthly cost at 30–50 active students

| Line | Cost |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro (daily backups + PITR) | $25 |
| LLM scoring — practice (standard API) | $20–60 |
| LLM scoring — mock (Batch API, 50% off) | $10–30 |
| Azure Speech (assessment + TTS) | $30–80 |
| Sentry, Resend, analytics | $0 |
| **Total** | **$105–215** |

Before Speaking ships, roughly $70–110.

### Cost architecture (decided)

Prompt caching with immutable versions, static block first · model tiering · deterministic
layer first, passed to the LLM as facts · hard output token caps · Batch API for all mock
scoring · TTS generated once and stored.

## 12. Legal and honesty position

**Trademark.** "PTE" and "PTE Core" are Pearson's registered trademarks. A footer notice
costs nothing and removes the easiest complaint available. Client has deferred.
**Recommendation stands: add before launch.**

**Question provenance.** Institute-supplied; origin unconfirmed. `questions` carries
`source` and `source_notes` and supports instant bulk deactivation. The publisher of record
is the admin — domain, hosting and payment are all in the admin's name.

**Data residency.** Supabase Canada Central.

**Score honesty — strengthened after research.** Three findings require care:

1. **Pearson publishes no task-level weightings.** The weighting table originally supplied
   to this project could not be verified against any source, official or secondary, and no
   PTE Core version exists anywhere. It has been replaced with a model derived from
   official question counts and rubric maximums. See `02-scoring-spec.md` §10.
2. **No raw-trait-to-90-scale conversion exists publicly**, and it cannot be reconstructed.
   Pearson uses IRT plus LSA and Versant, and states the overall score is not an average.
3. **Competitor calculators are documented as diverging from real scores by 10–30 points on
   speaking.** Do not copy their logic.

Consequently: **lead with trait scores and CLB bands, demote the 10–90 figure**, and label
every estimate. Never present a Kalindri number as a predicted official score.

Required wording wherever weights or estimates appear:

> Estimated using Pearson's published question counts and scoring rubrics. Pearson does not
> publish task weightings. This is our derivation, not an official figure.

## 13. Open items

| # | Item | Blocks |
|---|---|---|
| 1 | Launch bank volume: ~950 items or ~300? | Mock count; roadmap |
| 2 | Five sample questions per type | Payload schemas; import template |

Both block implementation. Research items are closed — see `06-research-brief.md`.

## 14. Brand

**Name:** Kalindri. **Domain:** kalindri.com, to be registered.
Unrelated businesses use the name in India (packaging, housing finance, sports retail). No
conflict in education.
