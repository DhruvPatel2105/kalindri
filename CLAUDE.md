# Kalindri — PTE Core Practice Platform

## What this is

Unofficial practice and AI-scoring platform for PTE Core, Pearson's English test for
Canadian economic immigration. Students practise question types and sit timed mocks;
responses are scored deterministically where possible and by AI where not, with
trait-level feedback.

Not affiliated with or endorsed by Pearson.

## Stack

Next.js 15 App Router · TypeScript · Supabase (Postgres/Auth/Storage, Canada Central) ·
Drizzle ORM · Zod · Tailwind · shadcn/ui · Anthropic SDK (standard + Batch API) ·
Azure Speech (TTS + Pronunciation Assessment) · LanguageTool self-hosted · Resend ·
Sentry · Vercel

## Repository layout

```
CLAUDE.md          this file — repo root, read every session
docs/              specifications. Authoritative. Read before building.
design/            Claude Design output — see below
src/               application code
```

### The design/ folder — read this before touching it

`design/` contains Claude Design output in `.dc.html` format, using `DCLogic`,
`sc-for` and `dc-import`. **This is NOT React and must never be copied literally.**

Read these files to understand layout, spacing, colour, states and behaviour, then
implement in React + Tailwind from scratch. The palette, component boundaries and
interaction states are authoritative; the syntax is not.

```
design/components/   14 shared components
design/screens/      24 screens (19 runners, results, dashboards, practice selection)
design/reference/    17 screenshots of the real PTE Core interface
```

Design brief: match the real exam's structure and flow so students build genuine
familiarity, with a distinct palette and slightly shifted positions so it is visibly
Kalindri's own product, not a reproduction.

Palette: teal `#1f6f6b` (dark `#17544f`) on warm paper `#f4f2ee`. Ink `#1e2a2a`,
muted `#5c6a68` / `#7d8a88`. Cards white on `#ddd9d0` borders. Prompt panels `#fafaf8`
with a 3px teal left rule. Amber `#b58b2a` for spelling and sub-60% bars, rust
`#b0472f` for grammar errors. Libre Franklin and IBM Plex Mono.

## Scoring honesty rules — read before touching any scoring or display code

Independent research established three facts that constrain what this product may claim.
These are correctness requirements, not style preferences.

1. **Pearson publishes NO task-level cross-skill weightings.** The percentage table
   originally supplied to this project could not be verified against any source, official
   or secondary, and no PTE Core version exists anywhere. Use only the **derived model**
   in `docs/02-scoring-spec.md` §10, computed from official question counts × rubric
   maximums. Never describe weights as "official" or "based on Pearson's weighting
   guidelines."
2. **No raw-trait-to-10-90 conversion exists publicly** and it cannot be reconstructed.
   Lead with trait scores and CLB bands. Any 10–90 figure is tertiary, shown as a RANGE,
   and always labelled an estimate. Never present it as a predicted official score.
3. **Never copy competitor calculator logic.** Documented divergence from real scores is
   10–30 points on speaking, 3–8 on writing. The "average enabling skills ÷ 6" formula is
   wrong and references skills Pearson discontinued in November 2021.

Required label wherever weights or estimated scores appear:

> Estimated using Pearson's published question counts and scoring rubrics. Pearson does
> not publish task weightings. This is our derivation, not an official figure.

**Standing range rule:** an estimated range must sit entirely inside the CLB band it
claims. Never let a range straddle a boundary. CLB 9 floors: Listening 82, Reading 78,
Speaking 84, Writing 88.

**Attribution:** the PTE Core → CLB alignment table is published by **Pearson** and
*used* by IRCC. Do not say IRCC publishes it.

## Non-negotiable architecture rules

1. **ONE `questions` table.** Type-specific data lives in `payload` (JSONB), validated by
   a Zod schema per type in `lib/questions/schemas/`. Never a table per question type.
2. **Scorer registry.** `lib/scoring/registry.ts` maps question type → scorer function.
   Adding a type means one schema, one component, one scorer. Nothing else changes.
3. **Deterministic scoring runs BEFORE any LLM call**, and its results are passed into the
   prompt as established facts. The model never counts words or finds typos.
4. **Content/Form gate.** For Write Email, score Content and Form first. If either is 0,
   the task scores 0 and no other trait is evaluated. Never spend tokens past a failed
   gate.
5. **All LLM scoring:** temperature 0, structured JSON, Zod-validated. Never parse free
   text. Hard `max_tokens` cap.
6. **Always persist raw model output** to `score_runs`, separately from `scores`.
7. **Scoring is a queued background job**, never inside the HTTP request.
8. **`org_id` on every table.** One organization exists; multi-tenancy is structural.
9. **Question snapshotting.** On submit, copy the question payload into the attempt.
   Questions are edited in place; history never breaks.
10. **Prompt versions are immutable.** Changing a prompt creates a new version.
11. **Batch API for mock scoring** (50% discount), standard API for practice mode.
12. **Never lose an attempt.** Persist every submission BEFORE attempting to score it.
    Every failed scoring job must be retryable without the student re-recording or
    re-typing. Lost attempts and silently unscored submissions are among the most common
    complaints against competing platforms.
13. **Feedback must be specific to the response.** A feedback string that would apply
    equally to any answer is a bug. Name the unaddressed bullet, the mispronounced word,
    the grammar error position. "Vague feedback" is the most common complaint in this
    market.
14. **Cross-skill weights live in the `skill_weights` table, never hardcoded.** Every
    surface showing them needs a derivation disclosure.
15. **Scaled scores are RANGES with a CLB band, never point estimates.**
    `11/15 · estimated CLB 8 · roughly 79–84`. Never `approximately 76`.

## Content protection

Question content is served defensively. These are architecture rules, not features.

- **NO endpoint ever returns a list of question payloads.** Questions are fetched one at
  a time, scoped to the current session. A route returning the bank in bulk must not
  exist — including in admin, where list views return metadata only (id, type,
  difficulty, status, stats) and never payload.
- **Rate limit question fetches per user**, not only submissions.
- Student email is watermarked on every question screen.
- Paste is disabled in response fields; text selection and right-click are disabled on
  question text.

The last two are deterrents, not security. Never describe them as protection anywhere in
the code, comments or UI.

## Question types (19 total)

```
Speaking:  READ_ALOUD, REPEAT_SENTENCE, DESCRIBE_IMAGE,
           RESPOND_TO_SITUATION, ANSWER_SHORT_QUESTION
Writing:   SUMMARIZE_WRITTEN_TEXT, WRITE_EMAIL
Reading:   FIB_RW, MCM_READING, REORDER_PARAGRAPH, FIB_READING, MCS_READING
Listening: SUMMARIZE_SPOKEN_TEXT, MCM_LISTENING, FIB_LISTENING, MCS_LISTENING,
           SELECT_MISSING_WORD, HIGHLIGHT_INCORRECT_WORDS, WRITE_FROM_DICTATION
```

**Highlight Correct Summary is NOT a PTE Core type.** Do not add it.

Currently implemented: *(update as phases complete)*

## Seed content

Seed questions are AI-generated per module as each type is built, then edited manually
later. They must be marked `is_seed_data = true` and be bulk-deletable in one action.

All content is original Canadian everyday and workplace context. **Never reproduce
Pearson material**, including anything appearing in `design/reference/` screenshots.

Launch target is ~300 questions, which supports **two** system mocks, not five. The mock
builder must still support more — this is a content limit, not a code limit.

## Scoring rules that are easy to get wrong

- **Negative marking** on MCM_READING, MCM_LISTENING, HIGHLIGHT_INCORRECT_WORDS:
  +1 correct, −1 incorrect, floored at 0. Set intersection inflates every score.
- **REORDER_PARAGRAPH scores adjacent pairs, not positions.** N boxes → max N−1.
- **WRITE_FROM_DICTATION and FIB_LISTENING score spelling.** Misspelled word = 0 for that
  word.
- **Write Email Form: 50–120 words** for full marks (not 100–120).
- **SWT has no spelling trait.** SST spelling is stricter than Write Email's.
- **Normalisation is mandatory** for ANSWER_SHORT_QUESTION (scored from a speech
  transcript): lowercase, strip punctuation and articles, expand contractions, plus
  `accepted_variants`.
- **READ_ALOUD contributes to Reading AND Speaking in Core.** PTE Academic dropped the
  Reading contribution in August 2025. That change does NOT apply to Core.
- **REPEAT_SENTENCE and ANSWER_SHORT_QUESTION have no count-in.** The microphone opens
  the instant the audio ends — no tone, no countdown. READ_ALOUD, DESCRIBE_IMAGE and
  RESPOND_TO_SITUATION do have a countdown.
- **Fluency scoring must include prosody.** Word-level accuracy alone rewards slow,
  word-by-word delivery. A required regression test asserts that a natural connected
  reading outscores a deliberately robotic reading of the same passage. A major
  competitor fails this and consequently teaches students a habit that lowers their real
  exam score.

## Trait maximums

```
WRITE_EMAIL              Content 3, EmailConventions 2, Form 2, Organization 2,
                         Vocabulary 2, Grammar 2, Spelling 2          → 15
SUMMARIZE_WRITTEN_TEXT   Content 2, Form 2, Grammar 2, Vocabulary 2   → 8
SUMMARIZE_SPOKEN_TEXT    Content 2, Form 2, Grammar 2, Vocabulary 2,
                         Spelling 2                                   → 10
DESCRIBE_IMAGE           Content 5, Pronunciation 5, Fluency 5        → 15
RESPOND_TO_SITUATION     Appropriacy 3, Pronunciation 5, Fluency 5    → 13
REPEAT_SENTENCE          Content 3, Pronunciation 5, Fluency 5        → 13
READ_ALOUD               Content (varies by prompt length), Pron 5, Fluency 5
ANSWER_SHORT_QUESTION    Vocabulary 1                                 → 1
```

Write Email register is inside **Email Conventions** — there is no separate Tone trait.
Respond to a Situation scores a **single Appropriacy trait** covering register,
politeness and detail together, not three separate scores.

## Official calibration anchors

Pearson's Core score guide contains annotated anchors with expert commentary for exactly
two task types. Load both into `calibration_fixtures` with `source='pearson_anchor'`:

- **WRITE_EMAIL** — CLB 4, 5, 7 (104 / 103 / 118 words), paragraph-level commentary
- **RESPOND_TO_SITUATION** — CLB 4, 5, 7, audio plus commentary on appropriacy,
  pronunciation and fluency

**No official anchors exist** for SUMMARIZE_WRITTEN_TEXT, SUMMARIZE_SPOKEN_TEXT or
DESCRIBE_IMAGE. These depend entirely on the hand-scored calibration set. Do not use
competitor sample scores — they are platform estimates, not official.

## Conventions

- Server Actions for mutations, not API routes, unless streaming
- Zod validation at every boundary
- No `any`. No unchecked non-null assertions
- Deterministic scorers must have unit tests
- Estimated scores labelled "estimated" in every UI surface
- Skill estimates stored and displayed as a CLB band plus a score RANGE, never a point
  value

## How to work in this repo

- **One session, one scope.** "Build the deterministic scorers" is a session. "Build the
  scoring system" is four sessions pretending to be one. Refuse to expand scope mid-task
  — say what you would add and let me decide.
- **Vertical slices, not horizontal layers.** One narrow thing working end to end beats
  three half-built layers.
- **Tests are written with the code, never after.** Deterministic scorers especially:
  they are pure functions and there is no excuse.
- **Read `docs/` before building.** The specs are authoritative and more detailed than
  this file.

## Do not

- Implement question types not listed as currently implemented
- Add payments, self-signup, or Google auth
- Refactor the schema without being asked
- Auto-block a flagged account — flags are for manual admin review only
- Show model audio or model answers before a student has attempted and read feedback
- Present estimated scores as predicted official scores
- Describe the weight model as official, or claim it comes from Pearson
- Display a bare 10–90 number without a range and an estimate label
- Copy scoring or calculator logic from competitor platforms
- Copy `.dc.html` syntax literally into React — read it as specification
- Build any endpoint that returns question payloads in bulk
- Reproduce Pearson question content, including from `design/reference/`
- Use the "average of enabling skills ÷ 6" overall-score formula. It is wrong and
  references enabling skills Pearson discontinued in November 2021
- Use competitor sample answers as scoring anchors — their scores are platform estimates
- **Ship a speaking scorer that rewards word-by-word reading.** This is APEUni's most
  damaging documented flaw and it actively harms students' real exam performance
