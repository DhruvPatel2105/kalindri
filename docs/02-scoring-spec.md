# Scoring Specification

**Rubric source:** *PTE Core Test Taker Score Guide*, Pearson, January 2026.
https://www.pearsonpte.com/content/dam/ELL/pte/pearsonpte/pdfs/PTE-Core-Score-Guide-2026.pdf

**Revision 2** — updated following independent research verification. Changes are marked
with the reason. The largest change is §10: the cross-skill weighting table has been
replaced with a derived model, because the original numbers could not be verified against
any source, official or secondary.

---

## 1. Scoring architecture

Every question type resolves through a **scorer registry**: `lib/scoring/registry.ts` maps
a question type to a scorer function. Adding a type means one Zod schema, one React
component, one scorer. Nothing else changes.

Three scorer families:

```
deterministic/   string and set matching. No API cost. 10 types.
llm/             content judgement. 5 types.
speech/          Azure pronunciation assessment. 5 types.
```

### Execution order — non-negotiable

```
1. Deterministic pre-scoring    word count, spelling, grammar
2. Hard gates                   Content=0 or Form=0 → total 0, stop
3. LLM / speech scoring         only if gates pass
4. Persist                      scores rows + score_runs raw output
```

Deterministic results are passed **into** the LLM prompt as established facts. The model
never counts words or finds typos. This is both cheaper and more accurate, because it stops
the numbers drifting between runs.

### Queued, never synchronous

Scoring runs as a background job, never inside the HTTP request. This gives retries on API
failure, rate limiting, per-call cost tracking, and survivability when a student closes the
tab.

**Research note:** "speaking jobs that never score" and "lost attempts" are among the most
common complaints against AlfaPTE, Gurully and PTE Tutorials. Never losing an attempt is a
competitive differentiator, not just hygiene. Every submission must be persisted before
scoring is attempted, and every failed scoring job must be retryable without the student
re-recording.

---

## 2. Normalisation (all deterministic types)

Applied before any comparison:

- Lowercase
- Strip punctuation and collapse whitespace
- Strip leading articles: `a`, `an`, `the`
- Expand contractions: `it's` → `it is`
- Optional singular/plural equivalence

**Mandatory for Answer Short Question**, which is scored from a speech-to-text transcript.
Without it, a student saying "a doctor" against a key of "doctor" is marked wrong.

**Not synonym matching.** Deferred to V2. Only Answer Short Question carries an
`accepted_variants` array in V1.

---

## 3. Deterministic scoring rules

| Type | Rule |
|---|---|
| R&W Fill in the Blanks | +1 per correct blank. No negative marking. |
| MCQ Multiple (Reading) | **+1 correct, −1 incorrect, floor 0** |
| Reorder Paragraph | **+1 per correctly ordered adjacent pair.** N boxes → max N−1 |
| Reading Fill in the Blanks | +1 per correct blank. No negatives. |
| MCQ Single (Reading) | 1 or 0 |
| MCQ Multiple (Listening) | **+1 correct, −1 incorrect, floor 0** |
| Fill in the Blanks (Listening) | +1 per correctly **spelled** word |
| MCQ Single (Listening) | 1 or 0 |
| Select Missing Word | 1 or 0 |
| Highlight Incorrect Words | **+1 correct, −1 incorrect, floor 0** |
| Write from Dictation | +1 per correctly **spelled** word |

**Three rules commonly implemented wrong:**

1. **Negative marking is real** on MCQ Multiple (both sections) and Highlight Incorrect
   Words. Simple set intersection inflates every score.
2. **Reorder scores adjacent pairs, not positions.** Five boxes = 4 maximum.
3. **Write from Dictation and Listening FIB score spelling.** A misspelled word loses that
   word entirely.

All deterministic scorers require unit tests.

---

## 4. Trait rubrics — official maximums

### Write Email — total 15

| Trait | Max | Thresholds |
|---|---|---|
| Content | 3 | addresses the task sufficiently and appropriately |
| Email Conventions | 2 | salutation, sign-off, register |
| Form | 2 | **2 = 50–120 words · 1 = 30–49 or 121–140 · 0 = <30 or >140** |
| Organization | 2 | logical structure, effective transitions |
| Vocabulary | 2 | lexis appropriate to context |
| Grammar | 2 | consistent grammatical control |
| Spelling | 2 | **2 = max 2 errors · 1 = 3–4 · 0 = numerous** |

**Hard gate:** Content and Form scored first. Either at 0 → whole task 0.

**Zero conditions:** off-topic; capitals only; no punctuation; significant
pre-prepared/memorised material.

### Summarize Written Text — total 8
Content 0–2 · Form 0–2 · Grammar 0–2 · Vocabulary 0–2. **No spelling trait.**
Form: 2 = 25–50 words · 1 = 5–24 or 51–60 · 0 = <5 or >60.

### Summarize Spoken Text — total 10
Content 0–2 · Form 0–2 · Grammar 0–2 · Vocabulary 0–2 · Spelling 0–2.
Form: 2 = 20–30 words · 1 = 5–19 or 31–40 · 0 = <5 or >40.
Spelling stricter than Write Email: 2 = one error · 1 = two or three · 0 = over three.

### Describe Image — total 15
Content 0–5 · Pronunciation 0–5 · Fluency 0–5

### Respond to a Situation — total 13
Appropriacy 0–3 · Pronunciation 0–5 · Fluency 0–5

### Repeat Sentence — total 13
Content 0–3 · Pronunciation 0–5 · Fluency 0–5
Content: 3 = all words correct sequence · 2 = ≥50% · 1 = <50% · 0 = almost nothing.
Hesitations, pauses, false starts and leading/trailing material are ignored.

### Read Aloud
Content (word-level error counting) · Pronunciation 0–5 · Fluency 0–5

**Research note:** Read Aloud dropped its Reading contribution in PTE *Academic* (August
2025) but **retains Reading + Speaking in PTE Core**. Do not import Academic guidance here.

### Answer Short Question — total 1
Vocabulary: 1 = appropriate word choice, 0 = not.

---

## 5. LLM scoring design

### Prompt structure (order matters for caching)

```
[STATIC — cached, byte-identical across all calls of this type]
  Role and task definition
  Full official band descriptors for every trait
  2–3 anchor examples with scores and justification
  Output JSON schema

[DYNAMIC — varies per call, always last]
  Question payload (scenario, bullet points, key_points)
  Student response
  Deterministic results (word count, spelling errors, grammar errors)
```

Prompt version is immutable — changing a prompt creates a new version.

### Settings

- Temperature **0**
- Structured JSON output, Zod-validated. Never parse free text.
- Hard `max_tokens` cap.
- Model tiering: stronger model for Write Email, SWT, SST; smaller model elsewhere.
- **Batch API for all mock scoring** (50% discount). Standard API for practice mode.

### Official anchor examples — UPDATED

Research confirmed the official Core score guide contains annotated anchors for **two**
task types, not one:

| Type | Anchors | Detail |
|---|---|---|
| **Write Email** | CLB 4, 5, 7 | Full response text + paragraph-level Pearson commentary. Word counts 104 / 103 / 118. |
| **Respond to a Situation** | CLB 4, 5, 7 | Audio + written commentary on appropriacy, pronunciation, fluency. |

Both sets go directly into their scoring prompts. These are the only official anchors that
exist for PTE Core.

**No official anchors exist for Summarize Written Text, Summarize Spoken Text, or Describe
Image** — not in the Core guide, not in the Academic guide, not in Pearson practice
products. Pearson's Question Bank explicitly states its tasks "are not currently scored."

Those three types depend entirely on your hand-scored calibration set. Do not borrow
competitor sample scores; research found they are all platform estimates, not official.

### Output contract

```jsonc
{
  "gate_passed": true,
  "traits": [
    { "name": "Content", "score": 2, "max": 3,
      "band_descriptor": "…",
      "feedback": "You covered points 1 and 2 but did not address the deadline in point 3.",
      "positive": "Your opening states the purpose clearly." }
  ],
  "total": 11,
  "total_max": 15,
  "template_warning": false
}
```

Every trait carries both a fix and a positive.

**Research note — feedback specificity is the market gap.** Users of Gurully describe
feedback as "vague"; the complaint recurs across platforms. Generic feedback is the norm.
Every feedback string must name a specific element of the student's own response: the
unaddressed bullet, the mispronounced word, the grammar error at a given position. A
feedback string that would apply equally to any answer is a bug.

---

## 6. Spelling policy

Pearson accepts US, UK, Canadian and Australian conventions but requires **one convention
used consistently** within a response.

**V1 decision:** accept all four, do **not** penalise mixing. Surface mixing as a note in
feedback rather than a deduction. Promote to a real penalty in V2.

Implementation: `nspell` with combined en-GB / en-US / en-CA / en-AU dictionaries.

---

## 7. Grammar checking

**Self-hosted LanguageTool.** Free, unlimited, no per-call cost. Runs as a container.

The public API is rate-limited and unreliable at volume. Do not delegate grammar to the
LLM; it costs money for something a free tool does more consistently.

Error lists with character offsets feed both the inline highlighting in the results UI and
the LLM prompt as facts.

---

## 8. Speaking scoring — the biggest competitive opportunity

Research identified speaking-score unreliability as **the single most cited failure across
every competitor**. This is where the market is weakest and where trust is won or lost.

### The specific trap to avoid

APEUni is widely reported to under-score fluency and Describe Image by 10–30 points, with
users scoring in the low 50s on the platform and 80+ on the real test. The structural
criticism is the important one:

> the platform effectively rewards reading **one word at a time**, because slow,
> disconnected delivery scores better than natural speech.

This is a scoring-design failure that actively teaches students a habit that lowers their
real exam score. It is the worst possible outcome for a practice platform.

**Requirements:**

1. Azure Pronunciation Assessment returns accuracy, fluency, completeness **and prosody**.
   Prosody must be included in the fluency computation. Word-level accuracy alone rewards
   robotic delivery.
2. Validate fluency scoring specifically against natural connected speech. A test fixture
   set should include a deliberately robotic word-by-word reading of a passage; it must
   **not** outscore a natural reading of the same passage. This is a required regression
   test, not an optional one.
3. Never present a low fluency score without naming the cause (pace, pausing, hesitation,
   repetition).

### Per-type approach

| Type | Content/accuracy | Delivery |
|---|---|---|
| Read Aloud | Transcript vs known text. **No LLM.** | Azure scripted mode |
| Repeat Sentence | Transcript vs known sentence, 0–3 bands. **No LLM.** | Azure scripted mode |
| Answer Short Question | Normalised transcript vs accepted variants. **No LLM.** | Minimal |
| Describe Image | LLM against `key_points` | Azure unscripted mode |
| Respond to a Situation | LLM against `key_points` + register | Azure unscripted mode |

Three of five speaking types need no LLM at all.

---

## 9. Calibration — expanded

**This is the difference between scoring that works and scoring that looks like it works.**

Research reframed this from an internal quality measure into a **market differentiator**.
Every competitor claims accuracy without evidence: AlfaPTE's "up to about 95%", Gurully's
"±5 points" and "95% across 144,420 attempts" are self-reported marketing figures with no
published methodology, sample or correlation study. Only Pearson's own product uses the
real engine.

**Publishing a genuine validation study would be unique in this market.**

### Three tiers of calibration

**Tier 1 — official anchors (available now).** Write Email and Respond to a Situation, CLB
4/5/7, from the Core score guide. Use directly in prompts and as fixtures.

**Tier 2 — hand-scored set (minimum viable, ~6 hours).** 10 answers per AI-scored type,
roughly 50 total, scored by you against the official rubrics. Stored as fixtures. Run the
harness after every prompt change; **mean absolute error per trait** is the metric. An MAE
increase is a regression regardless of how good the feedback text reads.

**Tier 3 — real-score validation (the differentiator).** Collect real reported PTE Core
scores from consenting students alongside their platform history. Publish correlation and
MAE per skill. Target a cohort of 20–30 students initially.

### Statistical floor for anything stronger

If you later want to fit your own raw-score-to-scale conversion, the IRT calibration floor
is approximately **150 responses per item** for a one-parameter model (ETS Research
Memorandum RM-20-06, Livingston, *Basic Concepts of Item Response Theory*; corroborated by
Schroeders & Gnambs, 2025). Partial-credit and continuous-trait tasks need several hundred
per item. This is out of reach at V1 scale and is a V3 ambition, not a V1 plan.

### Free ongoing calibration

Students can **flag a score they believe is wrong**. Flagged attempts queue for admin
review; admin can **override**. Every override is a labelled data point and the override
log becomes a growing calibration set at no cost.

Add a **"report your real exam score"** feature. A student who has sat the real test can
enter their four official skill scores. This is the highest-value data in the system and
costs nothing to collect.

---

## 10. Cross-skill weighting — REPLACED

### Why the original table was removed

Independent research established the following, and it is decisive:

1. **Pearson does not publish task-level contribution weights anywhere.** Not in the Core
   score guide, not in any Academic score guide (2012, 2024, 2025, June 2023), not in the
   Automated Scoring White Paper, not in the GSE alignment paper. The guide states only
   that some tasks assess more than one skill and contribute to both.
2. **The circulating percentage tables are a prep-industry artifact from a single origin.**
   They trace to a "360-point / 90-per-module" model and a pteielts.com table whose own
   author hedges that "the actual scoring equation that PTE uses is slightly different."
   AlfaPTE and Dream English publish *identical* figures, indicating copying rather than
   independent measurement. AlfaPTE describes them as "based on Pearson's official
   weighting guidelines" — a provenance claim Pearson does not corroborate.
3. **Every circulating table is for PTE Academic, not Core.** The specific Core percentages
   in the original spec appear **nowhere** — not in official sources, not in secondary
   sources, not in academic literature.
4. Peer-reviewed work on PTE validity (Riazi 2013; Zheng & Mohammadi 2013; Cao 2026)
   publishes no item-contribution weights.

**Do not ship the original table, and do not repeat the "based on official Pearson
weighting" framing.** That is AlfaPTE's unsupported claim and repeating it inherits their
credibility problem.

### The replacement: a derived model

Weights are now computed from two things Pearson **does** publish: **question counts per
task type** and **rubric maximums per task**. Raw points contributed to a skill are
`midpoint_question_count × points_toward_that_skill`, normalised to 100%.

Assumptions, stated so they can be challenged:
- Read Aloud content modelled as a 0–5 equivalent
- Pronunciation and fluency count toward Speaking only, not Reading or Listening
- Dual-skill written tasks (SWT, SST, HIW) split evenly between their two skills
- R&W FIB ≈ 5 blanks, Listening FIB ≈ 7 blanks, WFD ≈ 9 words per item

| Skill | Task | Derived | Previously claimed | Δ |
|---|---|---|---|---|
| **Speaking** | Repeat Sentence | 42.4% | 38% | +4.4 |
| | Read Aloud | 28.9% | 30% | −1.1 |
| | Describe Image | 15.6% | 18% | −2.4 |
| | Respond to Situation | 11.6% | 12% | −0.4 |
| | Answer Short Question | 1.6% | 2% | −0.4 |
| **Reading** | Read Aloud | 30.4% | 32% | −1.6 |
| | R&W Fill in Blanks | 25.8% | 25% | +0.8 |
| | Reading FIB | 21.1% | 22% | −0.9 |
| | Reorder Paragraph | 9.4% | 6% | +3.4 |
| | Summarize Written Text | 5.6% | 7% | −1.4 |
| | MCQ Multiple (R) | 3.5% | 2% | +1.5 |
| | Highlight Incorrect Words | 2.8% | 5% | −2.2 |
| | MCQ Single (R) | 1.4% | 1% | +0.4 |
| **Writing** | Write Email | 26.6% | 28% | −1.4 |
| | Write from Dictation | 22.3% | 27% | −4.7 |
| | R&W Fill in Blanks | 19.5% | 18% | +1.5 |
| | Listening FIB | 12.4% | 7% | +5.4 |
| | Summarize Spoken Text | 10.6% | 11% | −0.4 |
| | Summarize Written Text | 8.5% | 9% | −0.5 |
| **Listening** | Repeat Sentence | 30.6% | 39% | −8.4 |
| | Write from Dictation | 29.2% | 24% | +5.2 |
| | Listening FIB | 16.2% | 14% | +2.2 |
| | Summarize Spoken Text | 7.0% | 5% | +2.0 |
| | Highlight Incorrect Words | 5.6% | 13% | −7.4 |
| | Answer Short Question | 5.1% | 1% | +4.1 |
| | MCQ Multiple (L) | 3.5% | 2% | +1.5 |
| | MCQ Single (L) | 1.4% | 1% | +0.4 |
| | Select Missing Word | 1.4% | 1% | +0.4 |

### Why this is good news

Speaking, Reading and Writing reproduce the old table closely — most deltas under 3 points.
Listening diverges more (Repeat Sentence −8.4, Highlight Incorrect Words −7.4).

**The ranking is nearly identical in every skill.** The recommendation engine sorts tasks
by priority; it does not need precise percentages, only a correct ordering. The top tasks
are unchanged:

- **Speaking:** Repeat Sentence, then Read Aloud
- **Reading:** Read Aloud, then R&W Fill in Blanks, then Reading FIB
- **Writing:** Write Email, then Write from Dictation
- **Listening:** Repeat Sentence and Write from Dictation, near-tied

**Top three by cross-skill impact remain: Repeat Sentence, Read Aloud, Write from
Dictation.** The product's core advice survives the correction intact — it is now
defensible instead of borrowed.

### Required labelling

Wherever weights or derived scores appear:

> Estimated using Pearson's published question counts and scoring rubrics.
> Pearson does not publish task weightings. This is our derivation, not an official figure.

---

## 11. CLB conversion (official)

Verified from the Core score guide (p.9) and the standalone table at
https://www.pearsonpte.com/content/dam/ELL/pte/pearsonpte/pdfs/PTE-Core-to-CLB-Conversion-Table-2024.pdf

| CLB | Listening | Reading | Speaking | Writing |
|---|---|---|---|---|
| 10 | 89–90 | 88–90 | 89–90 | 90 |
| **9** | **82–88** | **78–87** | **84–88** | **88–89** |
| 8 | 71–81 | 69–77 | 76–83 | 79–87 |
| 7 | 60–70 | 60–68 | 68–75 | 69–78 |
| 6 | 50–59 | 51–59 | 59–67 | 60–68 |
| 5 | 39–49 | 42–50 | 51–58 | 51–59 |
| 4 | 28–38 | 33–41 | 42–50 | 41–50 |
| 3 | 18–27 | 24–32 | 34–41 | 32–40 |

**IRCC uses the lowest single skill.** No averaging, no compensation.

This table is subject to periodic review by Pearson and IRCC. Verify against canada.ca and
pearsonpte.com before each release.

---

## 12. The 10–90 estimate — DOWNGRADED

Research confirmed that **no official or academic raw-trait-to-scale conversion exists**,
and none can be reconstructed from public data.

What is documented: writing scored by the KAT engine using Latent Semantic Analysis;
speaking by Versant; Item Response Theory underpins the scale; overall Conditional Error of
Measurement 2.5–3.5 depending on CEFR level; overall reliability 0.97. Pearson states
plainly that trait scores "undergo a number of complex calculations" and that the overall
score is **not** an average.

**A widely circulated formula — averaging enabling skills and dividing by six — is wrong.**
It contradicts Pearson's own statement and references enabling skills that were removed
from score reports on **16 November 2021**. Do not use it. Do not copy any competitor's
calculator logic.

### Decision

**Lead with the trait score and the CLB band. Demote the 10–90 number.**

- **Primary display:** trait breakdown (e.g. `Content 2/3 · Form 2/2 · Grammar 1/2`).
  Fully grounded in the official rubric and defensible to any student.
- **Secondary display:** estimated **CLB band** per skill. This is what the student
  actually needs, since IRCC works in CLB.
- **Tertiary, clearly labelled:** an approximate 10–90 figure, shown as a range rather than
  a point value where possible.

Never present the 10–90 figure as a predicted official score. Competitor calculators that
do this are documented as diverging from real scores by 10–30 points on speaking and 3–8
points on writing — in both directions.

---

## 13. Recommendation engine

Weight alone gives bad advice. A student at 95% accuracy on Read Aloud gains nothing from
practising it, however heavily weighted.

```
priority = derived_skill_weight × (1 − current_accuracy) × confidence
```

`confidence` = 0 below 5 attempts on that type. Below the threshold the UI shows
*"needs more data — practise 5 of these"* rather than a ranking.

**Optimise for the blocking skill only.** Improving Speaking from 84 to 88 is worthless
while Writing sits at 79.

Worked example, Reading-blocked student, using derived weights:

| Task | Derived weight | Accuracy | Headroom | Priority |
|---|---|---|---|---|
| Read Aloud | 30.4% | 92% | 8% | 2.4 |
| **R&W Fill in Blanks** | **25.8%** | **45%** | **55%** | **14.2** |
| Reading FIB | 21.1% | 60% | 40% | 8.4 |
| Reorder Paragraph | 9.4% | 30% | 70% | 6.6 |
| MCQ Single (R) | 1.4% | 20% | 80% | 1.1 |

Reorder *feels* like the worst skill at 30% accuracy. R&W Fill in Blanks is worth more than
twice the effort. MCQ Single, at 80% wrong, is genuinely not worth fixing.

**Show this table to the student.** Research confirmed no competitor operationalises
cross-skill impact into a personalised recommender. The concept appears in blog content on
ptecorepractice.com, PTE Monster and PrepareBuddy, but no platform turns it into a per-user
engine. This is a clean, defensible differentiator.

---

## 14. Template detection

Pre-prepared or memorised material scores **0 for Content** in the real exam. Coaching
students use templates heavily, and no competitor warns them.

Flag responses where a high proportion of text matches known template phrasing or matches
the student's own previous submissions on different questions. Surface as a warning, not a
penalty, in V1.

---

## 15. Re-scoring policy

**Scores are frozen at what the student saw.** Improving a rubric does not retroactively
change history.

`score_runs` retains every raw output, so **shadow re-scoring is available for admin
analysis only**. You can measure whether a new prompt version would have scored past
attempts better, without altering anything the student sees.
