# Kalindri — Specification Set

**Revision 2**, updated after two independent research runs.

Complete specification for a PTE Core practice and AI-scoring platform, verified against
Pearson's official *PTE Core Test Taker Score Guide* (January 2026) and independent
competitor research.

## Documents

| File | Purpose |
|---|---|
| `00-PRD.md` | Product requirements: users, scope, four differentiator pillars, budget, legal and honesty position |
| `01-question-types.md` | All 19 types: counts, timing, payload shapes, mock blueprint, bank sizing |
| `02-scoring-spec.md` | Official rubrics, deterministic rules, LLM design, **derived weight model**, calibration strategy |
| `03-data-model.md` | Full schema including calibration fixtures and real-score capture |
| `04-ux-spec.md` | Screens, flows, CLB-led score display, results layouts, admin panel |
| `05-build-roadmap.md` | Phases 0–8 with exit criteria and release checklist |
| `06-research-brief.md` | Research findings and what remains open |
| `07-competitive-position.md` | Per-platform teardown and the complaint-driven feature list |
| `CLAUDE.md` | Drop at the repo root before the first Claude Code session |

## What research changed

**1. The weighting table was replaced.** Pearson publishes no task-level cross-skill
weightings. The circulating percentage tables are a prep-industry artifact traceable to a
single origin, all for PTE *Academic*, and the specific Core numbers originally supplied
appear in no source at all. They have been replaced with a model derived from official
question counts and rubric maximums.

The ranking survives almost unchanged, which is what matters: the recommendation engine
sorts by priority, not by absolute percentage. **Repeat Sentence, Read Aloud and Write from
Dictation remain the three highest-impact tasks.**

**2. The 10–90 score was demoted.** No public raw-trait-to-scale conversion exists and none
can be reconstructed. CLB bands now lead; numeric estimates are shown as ranges and always
labelled.

**3. Official anchors exist for two types, not one.** Write Email *and* Respond to a
Situation, each at CLB 4, 5 and 7 with Pearson commentary. Summarize Written Text, Summarize
Spoken Text and Describe Image have none and depend entirely on hand-scored calibration.

**4. Both differentiators were confirmed unbuilt.** No competitor delivers dynamic
blocking-skill diagnosis or personalised cross-skill recommendations. ptecorepractice.com is
closest and is one iteration away.

**5. Two new pillars were added.** Trustworthy speaking scoring and provable calibration —
both derived from the complaint analysis, both currently unoccupied.

## Reading order

**Researching:** `06-research-brief.md` → `07-competitive-position.md`
**Building:** `CLAUDE.md` → `05-build-roadmap.md` → `03-data-model.md`
**Understanding the scoring:** `02-scoring-spec.md` §10 and §12 are the two sections that
changed most.

## Read the source

https://www.pearsonpte.com/content/dam/ELL/pte/pearsonpte/pdfs/PTE-Core-Score-Guide-2026.pdf

Forty pages. It contains the only official annotated sample responses that exist for PTE
Core — Write Email and Respond to a Situation at CLB 4, 5 and 7, with Pearson's own
commentary. Those are your scoring anchors.

## Corrections this specification makes to the original working material

| Was assumed | Actually |
|---|---|
| Highlight Correct Summary is a Core type | It is not — PTE Academic only |
| Write from Dictation not in Core | It is, 3–4 per test, ~22% of Writing |
| 16 task types | 19 types, 52–67 tasks |
| Write Email is 100–120 words | 50–120 words for full Form marks |
| Read Aloud has no content score | It does — word-level error counting |
| Read Aloud's Reading contribution was dropped | Dropped in **Academic** (Aug 2025); **retained in Core** |
| Respond to a Situation is 2–3 questions | 2–4 |
| MAC address device locking | Impossible in a browser — replaced with single active session |
| Weighting percentages are official Pearson data | Unverifiable in any source — replaced with a derivation |
| Trait scores convert to 10–90 via a known method | No such method is published |
| Official anchors exist only for Write Email | Also for Respond to a Situation |

## Two decisions still blocking implementation

1. **Launch question-bank volume** — ~950 items (five mocks) or ~300 (two mocks)?
2. **Five sample questions per type** from the institute's bank.

## Open recommendations declined by the client

- **Pearson disclaimer.** A footer stating no affiliation costs nothing and removes the
  easiest complaint available. Deferred to V2.
- **Privacy policy.** Relevant once Canadian student data is hosted. Deferred to V2.
- **30 hand-scored calibration answers per type.** Reduced to 10 per type (~50 total) as a
  realistic minimum. Now more important than before, since three task types have no official
  anchors at all.
