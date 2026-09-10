# Research Findings and Remaining Questions

**Revision 2.** Two research runs completed. This document now records **what was
established** and what remains open.

---

## Summary of what changed

| Priority | Status | Impact on the build |
|---|---|---|
| 1. Weighting percentages | **Resolved — negative** | Table replaced with a derived model |
| 2. Trait→90 conversion | **Resolved — does not exist** | 10–90 figure demoted; lead with CLB |
| 3. Question provenance | Open — ask the institute | Provenance columns already built |
| 4. Competitor teardown | **Resolved — differentiators confirmed** | Two new pillars added |
| 5. Azure validation | Open — documentation lookup | Before Phase 5 |
| 6. Anchor examples | **Resolved — partially positive** | Two official anchor sets, not one |
| 7. Operational pricing | Open — documentation lookup | Before Phase 0 |

---

## FINDING 1 — The weighting table is unverifiable. Replaced.

**Established:**

- Pearson publishes **no task-level contribution weights anywhere**. Checked: PTE Core Score
  Guide (Jan 2026), PTE Academic Score Guides (2012, June 2023, Nov 2024, July 2025), the
  Automated Scoring White Paper (May 2018), and the GSE alignment paper. The Core guide
  states only that some tasks assess more than one skill and contribute to both.
- The circulating tables are a **prep-industry artifact from a single origin** — a
  "360-point / 90-per-module" model and a pteielts.com table whose own author hedges that
  the real equation differs. AlfaPTE and Dream English publish **identical** figures,
  indicating copying, not measurement.
- AlfaPTE frames them as "based on Pearson's official weighting guidelines," a provenance
  claim Pearson does not corroborate. SpeakShark states plainly the figures "do not trace to
  any Pearson document."
- **Every circulating table is PTE Academic.** The specific Core percentages supplied to
  this project appear **nowhere** — official, secondary or academic.
- Peer-reviewed PTE validity work (Riazi 2013; Zheng & Mohammadi 2013; Cao 2026) publishes
  no item-contribution weights.
- Enabling-skill scores were removed from PTE Academic score reports on **16 November 2021**.
  No era of Pearson documentation described per-item percentage contributions.

**Action taken:** replaced with a model derived from official question counts × rubric
maximums. See `02-scoring-spec.md` §10.

**Why the product survives:** the derived model reproduces the old table closely for
Speaking, Reading and Writing (most deltas under 3 points) and diverges on Listening. The
**ranking is nearly identical in every skill**, and the recommendation engine sorts by
priority rather than using absolute percentages. Top three by cross-skill impact remain
Repeat Sentence, Read Aloud and Write from Dictation.

---

## FINDING 2 — No trait-to-scale conversion exists. Demoted.

**Established:**

- Writing scored by the KAT engine using Latent Semantic Analysis; speaking by Versant; IRT
  underpins the scale. Overall Conditional Error of Measurement 2.5–3.5 by CEFR level;
  overall reliability 0.97.
- Pearson states the overall score is **not** an average and that trait scores "undergo a
  number of complex calculations."
- **No lookup table, item parameters or equating detail is published**, for Core or Academic.
- No published examples exist pairing a real response with both its trait scores and its
  official reported score.
- The widely repeated **"average of enabling skills ÷ 6" formula is wrong** — it contradicts
  Pearson and references skills discontinued in 2021.
- Competitor calculators disclaim accuracy. Gurully: "does not predict your final exam
  score." Reported divergence: 3–8 points on essays, 10–30 points on speaking, in both
  directions.
- **The CLB alignment table is official and is the one reliable conversion.**

**Action taken:** trait scores and CLB bands lead; the 10–90 figure is demoted to a clearly
labelled tertiary estimate, shown as a range where possible.

**What would change this:** collecting real reported scores from consenting students. The
IRT calibration floor is ~150 responses per item for a 1PL model (ETS RM-20-06, Livingston;
Schroeders & Gnambs 2025), and several hundred for partial-credit tasks. A V3 ambition.

---

## FINDING 3 — Official anchors exist for two types, not one.

**Established.** The Core Score Guide (Jan 2026) contains annotated anchors with Pearson
commentary for:

- **Write Email** — CLB 4, 5, 7. Full text plus paragraph-level commentary. Word counts
  104 / 103 / 118.
- **Respond to a Situation** — CLB 4, 5, 7. Audio plus written commentary on appropriacy,
  pronunciation and fluency.

**No official anchors exist** for Summarize Written Text, Summarize Spoken Text or Describe
Image — not in the Core guide, not in Academic guides, not in Pearson practice products.
Pearson's Question Bank states its tasks "are not currently scored."

The Official Guide to PTE Academic contains field-test sample responses with rubrics, but
generally without attached scaled scores. Treat as directional only.

**Action taken:** both anchor sets go into their scoring prompts. The three unanchored types
depend entirely on the hand-scored calibration set, which raises its importance.

---

## FINDING 4 — Differentiators confirmed, with one caveat and two additions.

**Established:**

- **No competitor delivers dynamic blocking-skill identification.** The closest is
  ptecorepractice.com — a small, GitHub-hosted, Core-only freemium platform with a per-skill
  CLB calculator and static guidance to "always prioritize the lowest-skill score." Its own
  pricing table labels this a "Static target plan": editorial content, not a per-user engine.
  **Caveat: this rival is one product iteration from occupying the space.**
- **No competitor operationalises cross-skill impact** into a personalised recommender. The
  concept appears in blog content (ptecorepractice.com, PTE Monster, PrepareBuddy) but is
  never productised.
- **Two new pillars emerged from the complaint analysis:**
  1. **Trustworthy speaking scoring.** The most cited failure across every platform. APEUni
     is reported to under-score fluency by 10–30 points and to reward reading one word at a
     time — a scoring-design failure that teaches a habit lowering real exam scores.
  2. **Provable calibration.** All accuracy claims are unsubstantiated marketing. Publishing
     a real validation study would be unique.
- **The real benchmark is Pearson's own product**, not AlfaPTE. Official PTE Core AI Practice
  uses the genuine scoring engine; the Scored Practice Test is $35.99 USD, designed to be
  taken once, valid one year. The bundle includes a 300-question Core question bank with
  model answers. You cannot out-calibrate it — compete on breadth, price, diagnosis and
  recommendations, none of which it offers.

**Complaints, ordered by recurrence — this is a feature list:**

1. Unreliable speaking scoring (most damaging)
2. Unprovable accuracy claims
3. Vague, generic feedback
4. Question-bank defects — mismatched text and audio, missing sections
5. Lost attempts, unscored submissions, blank-screen failures, single-attempt mocks
6. Punitive commercial terms — zero refunds, deactivation after negative reviews

**Action taken:** pillars 3 and 4 added to the PRD; a robotic-reading regression test added
to the speaking scorer requirements; never-lose-an-attempt made explicit in the scoring
architecture; feedback specificity made a correctness requirement rather than a nice-to-have.

---

## STILL OPEN — quick lookups, no research run needed

### A. Azure Speech validation (before Phase 5)

1. Current Pronunciation Assessment pricing per audio hour, free tier limits
2. Confirm both scripted and unscripted assessment modes are available
3. Does prosody scoring map usefully onto Pearson's fluency bands? **Critical** — prosody is
   what prevents rewarding word-by-word reading
4. Required audio format; confirm 16kHz mono PCM is optimal
5. Latency per request
6. Neural voices available for en-CA, en-GB, en-US, en-AU
7. TTS pricing per character and free tier

### B. Operational pricing (before Phase 0)

1. Supabase Pro pricing, storage limits, backup retention, PITR window
2. Anthropic Batch API — confirm discount, typical completion time, whether prompt caching
   combines with batching
3. LanguageTool self-hosting resource requirements and where it runs
4. Resend free tier limits
5. Vercel Pro limits relevant to long-running scoring jobs
6. kalindri.com availability and renewal cost after the promotional term

### C. Question provenance — ask, don't research

Ask the institute plainly: written by their teachers, bought from a publisher, or compiled
from recent test-takers? Provenance columns are already in the schema either way.

---

## Standing caveats

- Pearson revises formats periodically. Read Aloud **dropped its Reading contribution in
  PTE Academic in August 2025 but retains Reading + Speaking in Core.** Do not import
  Academic guidance. Verify against the current Core guide before each release.
- The CLB table is subject to review by Pearson and IRCC. Confirm on canada.ca and
  pearsonpte.com before relying on exact cut scores.
- Absence of evidence is not proof. Pearson may hold internal weighting constants; the
  finding is that none is public.
- Reddit could not be retrieved during research; that evidence bucket remains open.
- Competitor paywalled features were assessed from marketing copy, not hands-on.

---

## Two decisions still blocking implementation

Not research. Answers needed from you.

1. **Launch question-bank volume** — ~950 items (five mocks) or ~300 (two mocks)?
2. **Five sample questions per type** from the institute's bank.
