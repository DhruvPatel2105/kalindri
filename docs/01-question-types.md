# Question Type Specification — All 19 PTE Core Types

**Source of truth:** *PTE Core Test Taker Score Guide*, Pearson, January 2026.
https://www.pearsonpte.com/content/dam/ELL/pte/pearsonpte/pdfs/PTE-Core-Score-Guide-2026.pdf

Read that document. This spec records structure, counts and payload shapes; the score guide
contains the full band descriptors and **two sets** of worked examples with Pearson's own
expert commentary — Write Email and Respond to a Situation, each at CLB 4, 5 and 7.

**Revision 2** — updated after research verification. Anchor availability corrected; a Core
vs Academic divergence noted on Read Aloud.

---

## Corrections to earlier working assumptions

These were wrong in the source material this project started from. They are now confirmed
against the official guide.

| Was assumed | Actually |
|---|---|
| Highlight Correct Summary is a Core type | **It is not.** PTE Academic only. Remove entirely. |
| Write from Dictation not in Core | **It is.** 3–4 questions per test. |
| 16 task types | **19 task types**, 52–67 tasks per test. |
| Write Email is 100–120 words | **50–120 words** for full Form marks. |
| Read Aloud has no content score | **It does.** Word-level error counting. |
| Respond to a Situation is 2–3 questions | **2–4 questions.** |
| SWT Form is 0–1 | **0–2.** |
| Official anchors exist only for Write Email | **Also for Respond to a Situation**, CLB 4/5/7 with audio and commentary. |
| Read Aloud feeds Reading in all PTE tests | **Core only.** PTE Academic dropped Read Aloud's Reading contribution in Aug 2025; Core retains it. Do not import Academic guidance. |

---

## Test structure

| Part | Module | Time | Types |
|---|---|---|---|
| 1 | Speaking & Writing | 50–65 min | 7 |
| 2 | Reading | 27–37 min | 5 |
| 3 | Listening | 22–37 min | 7 |

Total: 52–67 tasks, under 2 hours. No breaks.

---

## Scoring classification

This determines cost and implementation complexity.

**Deterministic — no API cost, exact and instant (10 types)**
All 5 Reading types · Listening MCQ Single · Listening MCQ Multiple · Listening FIB ·
Select Missing Word · Highlight Incorrect Words · Write from Dictation

**LLM-scored (5 types, content only)**
Write Email · Summarize Written Text · Summarize Spoken Text ·
Describe Image (content) · Respond to a Situation (appropriacy)

**Speech API — Azure (5 types, delivery)**
Read Aloud · Repeat Sentence · Answer Short Question ·
Describe Image (delivery) · Respond to a Situation (delivery)

Read Aloud, Repeat Sentence and Answer Short Question need **no LLM at all** — their
content scores are transcript comparison against known text.

---

# PART 1 — SPEAKING & WRITING

## 1. Read Aloud
**Count:** 6–7 · **Skills:** Reading + Speaking · **Scoring:** Partial credit

Text appears on screen. 30–40 seconds preparation, then read aloud.

**Traits:** Content (each replacement, omission or insertion counts as one error; maximum
depends on prompt length) · Pronunciation 0–5 · Fluency 0–5

**Core-specific:** Read Aloud contributes to **both Reading and Speaking** in PTE Core.
PTE Academic removed its Reading contribution in August 2025 — that change does **not**
apply here.

**Scoring warning:** fluency must include prosody. Word-level accuracy alone rewards slow,
disconnected, word-by-word delivery — the documented failure mode of a major competitor,
which teaches students a habit that lowers their real exam score.

**Payload:**
```
text                  string, 50-70 words
prep_seconds          int, default 35
record_seconds        int, default 40
model_audio_url       string, generated TTS — shown AFTER attempt only
difficulty            enum
```
Note: model audio must never play before the attempt. If it does, this stops being a
reading task and becomes Repeat Sentence.

## 2. Repeat Sentence
**Count:** 10–12 · **Skills:** Listening + Speaking · **Scoring:** Partial credit

**Highest cross-skill impact task in the test** — ~38% of Speaking and ~39% of Listening.

Audio plays once. Student repeats it.

**Traits:** Content 0–3 · Pronunciation 0–5 · Fluency 0–5

Content bands: 3 = all words in correct sequence · 2 = at least 50% · 1 = under 50% ·
0 = almost nothing. Hesitations, pauses and leading/trailing material are ignored.

**Payload:**
```
sentence_text         string, 8-12 words — required, drives audio AND answer key
audio_url             string, generated from sentence_text
accent                enum
record_seconds        int, default 15
```

## 3. Describe Image
**Count:** 3–4 · **Skill:** Speaking · **Scoring:** Partial credit

25 seconds preparation, 40 seconds to speak.

**Traits:** Content 0–5 · Pronunciation 0–5 · Fluency 0–5

Content banding is about *relationships and implications*, not enumeration. Full marks
requires all elements, their relationships, and a conclusion or implication. Listing
elements without connecting them caps at 1.

**No official anchors exist for this type.** Depends entirely on your hand-scored
calibration set. Do not borrow competitor sample scores — research confirmed they are all
platform estimates, not official Pearson scores.

**Payload:**
```
image_url             string
image_type            enum: bar|line|pie|table|map|process|photo
key_points            string[] — elements, relationships, trend, conclusion
model_answer          string
prep_seconds          int, default 25
record_seconds        int, default 40
```

## 4. Respond to a Situation
**Count:** 2–4 · **Skill:** Speaking · **Scoring:** Partial credit

Core-only type. A situation is described; student responds appropriately.

**Traits:** Appropriacy 0–3 · Pronunciation 0–5 · Fluency 0–5

Appropriacy is a **single trait** covering register, politeness and level of detail
together — not three separate scores.

**Official anchors available:** CLB 4, 5 and 7 responses with audio and Pearson commentary
on appropriacy, pronunciation and fluency, in the Core score guide. Use directly in the
scoring prompt.

**Payload:**
```
situation_text        string
audio_url             string — situation is also read aloud
register              enum: formal|informal
key_points            string[] — what an adequate response must cover
model_answer          string
prep_seconds          int, default 20
record_seconds        int, default 40
```

## 5. Answer Short Question
**Count:** 5–6 · **Skills:** Listening + Speaking · **Scoring:** Correct/incorrect

**Trait:** Vocabulary — 1 for appropriate word choice, 0 otherwise.

**Payload:**
```
question_text         string
audio_url             string
accepted_answers      string[] — REQUIRED, include variants
record_seconds        int, default 10
```
Scored from a speech transcript, so normalisation is mandatory (see scoring spec).

## 6. Summarize Written Text
**Count:** 1–2 · **Skills:** Reading + Writing · **Scoring:** Partial credit

One sentence, 25–50 words, 10 minutes.

**Traits:** Content 0–2 · Form 0–2 · Grammar 0–2 · Vocabulary 0–2 · **Total 8**

Form: 2 = 25–50 words · 1 = 5–24 or 51–60 · 0 = under 5 or over 60, or written in capitals,
or no punctuation, or bullet points only.

**No spelling trait.**

**Payload:**
```
passage               string, 200-300 words
key_points            string[] — REQUIRED, 3-4 ideas a correct summary must contain
model_answer          string
time_limit_seconds    int, default 600
```

## 7. Write Email
**Count:** 2–3 · **Skill:** Writing · **Scoring:** Partial credit

Core-only type; replaces the PTE Academic essay. 9 minutes.

**Traits:** Content 0–3 · Email Conventions 0–2 · Form 0–2 · Organization 0–2 ·
Vocabulary 0–2 · Grammar 0–2 · Spelling 0–2 · **Total 15**

**Hard gate:** Content and Form are scored first. If either is 0, the whole task scores 0
and no other trait is evaluated. Implement this before spending tokens on anything else.

Form: 2 = **50–120 words** · 1 = 30–49 or 121–140 · 0 = under 30 or over 140, or capitals
only, or no punctuation.

Spelling: 2 = max two errors · 1 = three or four · 0 = numerous.

Register is **not** a separate trait — it lives inside Email Conventions (salutation,
sign-off, formality).

Responses containing significant pre-prepared/memorised material score **0 for Content**.

**Official anchors available:** CLB 4, 5 and 7 responses (104, 103 and 118 words) with
paragraph-level Pearson commentary, in the Core score guide. Use directly in the scoring
prompt.

**Payload:**
```
scenario              string — the situation
bullet_points         string[] — exactly 3, all must be addressed
recipient             string
register              enum: formal|informal
model_answer          string
time_limit_seconds    int, default 540
```

---

# PART 2 — READING

All five types are deterministic. No API cost.

## 8. Reading & Writing: Fill in the Blanks
**Count:** 5–6 · **Skills:** Reading + Writing · 1 point per correct blank, no negatives

```
passage_with_blanks   string, {{1}} {{2}} markers
blanks                [{ index, options[4], correct_option }]
```

## 9. Multiple Choice, Multiple Answers (Reading)
**Count:** 1–2 · **+1 per correct, −1 per incorrect, floored at 0**

```
passage, question, options[], correct_option_ids[]
```

## 10. Reorder Paragraph
**Count:** 2–3 · **1 point per correctly ordered ADJACENT PAIR**

Five boxes means a maximum of 4 points, not 5. This is the single most commonly
mis-implemented scoring rule in PTE practice apps.

```
boxes                 string[] in correct order
```

## 11. Reading: Fill in the Blanks
**Count:** 4–5 · 1 point per correct blank, no negatives · Drag and drop

```
passage_with_blanks, word_bank[] (includes distractors), correct_answers[]
```

## 12. Multiple Choice, Single Answer (Reading)
**Count:** 1–2 · Correct/incorrect · Worth ~1% of Reading. Lowest priority type.

---

# PART 3 — LISTENING

## 13. Summarize Spoken Text
**Count:** 1–2 · **Skills:** Listening + Writing · **Scoring:** Partial credit

20–30 words. **LLM-scored.**

**Traits:** Content 0–2 · Form 0–2 · Grammar 0–2 · Vocabulary 0–2 · Spelling 0–2 ·
**Total 10**

Form: 2 = 20–30 words · 1 = 5–19 or 31–40 · 0 = under 5 or over 40.
Spelling is **stricter than Write Email**: 2 = one error · 1 = two or three · 0 = over three.

```
transcript            string, 60-90 seconds of speech — drives audio AND key points
audio_url, accent
key_points            string[] — REQUIRED
model_answer
time_limit_seconds    int, default 600
```

## 14. Multiple Choice, Multiple Answers (Listening)
**Count:** 1–2 · **+1 correct, −1 incorrect, floored at 0**

## 15. Fill in the Blanks (Listening)
**Count:** 2–3 · **Skills:** Listening + Writing · 1 point per correctly **spelled** word

Typed, not dropdown. Spelling counts.

```
transcript, audio_url, blank_word_indices[]
```

## 16. Multiple Choice, Single Answer (Listening)
**Count:** 1–2 · Correct/incorrect · ~1% of Listening.

## 17. Select Missing Word
**Count:** 1–2 · Correct/incorrect

Audio ends with a beep replacing the final word(s). Beep appended programmatically.

```
transcript, missing_word_position, options[], correct_option_id
```

## 18. Highlight Incorrect Words
**Count:** 1–2 · **Skills:** Listening + Reading · **+1 correct, −1 incorrect, floored at 0**

On-screen transcript contains altered words; audio is correct. Student clicks the
mismatches.

```
true_transcript       string — generates the audio
altered_transcript    string — displayed on screen
altered_word_indices  int[]
```

## 19. Write from Dictation
**Count:** 3–4 · **Skills:** Listening + Writing · **1 point per correctly spelled word**

~27% of Writing and ~24% of Listening. Deterministic, fast, free to score. **Highest
return per minute of student effort in the entire product.**

```
sentence_text         string, 8-12 words — is the question, the audio source AND the key
audio_url, accent
```

---

## Mock test blueprint (official, verified)

Per-type counts sum exactly to Pearson's stated 52–67 range.

| Type | Min | Max |
|---|---|---|
| Read Aloud | 6 | 7 |
| Repeat Sentence | 10 | 12 |
| Describe Image | 3 | 4 |
| Respond to a Situation | 2 | 4 |
| Answer Short Question | 5 | 6 |
| Summarize Written Text | 1 | 2 |
| Write Email | 2 | 3 |
| R&W Fill in the Blanks | 5 | 6 |
| MCQ Multiple (Reading) | 1 | 2 |
| Reorder Paragraph | 2 | 3 |
| Reading Fill in the Blanks | 4 | 5 |
| MCQ Single (Reading) | 1 | 2 |
| Summarize Spoken Text | 1 | 2 |
| MCQ Multiple (Listening) | 1 | 2 |
| Fill in the Blanks (Listening) | 2 | 3 |
| MCQ Single (Listening) | 1 | 2 |
| Select Missing Word | 1 | 2 |
| Highlight Incorrect Words | 1 | 2 |
| Write from Dictation | 3 | 4 |
| **Total** | **52** | **67** |

---

## Question bank sizing

Five unique mocks plus a usable practice pool. Practice is unlimited and questions repeat
freely, but a small pool is exhausted within one sitting.

| Type | 5-mock minimum | Recommended |
|---|---|---|
| Repeat Sentence | 60 | **150** |
| Read Aloud | 35 | **100** |
| Write from Dictation | 20 | **100** |
| Answer Short Question | 30 | 80 |
| R&W Fill in the Blanks | 30 | 80 |
| Reading FIB | 25 | 80 |
| Write Email | 15 | 50 |
| Describe Image | 20 | 40 |
| SWT / SST | 10 each | 40 each |
| Respond to a Situation | 20 | 40 |
| Reorder / Listening FIB / HIW | 15 each | 40 each |
| MCQ types, Select Missing Word | 10 each | 20–25 each |
| **Total** | **~300** | **~950** |

The distribution favours the builder: the three highest-impact types (Repeat Sentence,
Read Aloud, Write from Dictation) are single sentences, and one clean text column produces
the question, the audio and the answer key simultaneously.
