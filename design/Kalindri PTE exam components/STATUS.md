# Kalindri — build status

Design-only status. Everything below is HTML/design work; no backend, scoring engine or data layer is in scope here.

Last updated: 8 September 2026

---

## Built — components (10)

| Component | Used by |
|---|---|
| `StatusBox` | every screen with audio/video |
| `VolumeControl` | standalone; not yet placed in exam chrome |
| `RecordedAnswerBox` | all 5 speaking types |
| `TextEntryFooter` | Write Email, SWT, SST, Write from Dictation |
| `McqOptionList` | 4 MCQ types + Select Missing Word |
| `TraitBar` | both results screens |
| `DropdownBlank` | R&W Fill in the Blanks |
| `WordBankBlanks` | Reading Fill in the Blanks |
| `HighlightWords` | Highlight Incorrect Words |
| `QuestionListPanel` | Write Email, Reading MCQ (slide-over question picker) |

## Built — all 19 question types

**Speaking (5):** Read Aloud · Repeat Sentence · Describe Image · Respond to a Situation · Answer Short Question

**Writing (2):** Write Email · Summarize Written Text

**Reading (4):** R&W Fill in the Blanks · MCQ Multiple · MCQ Single · Re-order Paragraphs · Reading Fill in the Blanks *(5 files — R&W FIB is scored across both skills)*

**Listening (7):** Summarize Spoken Text · MCQ Multiple · Fill in the Blanks · Highlight Incorrect Words · MCQ Single · Select Missing Word · Write from Dictation

All in practice-mode chrome: no item counter, Submit rather than Next, original Canadian-context content.

## Built — results (2 of ~4)

- `WriteEmailResults` — seven traits, annotated text, per-trait feedback, attempt comparison, model answer, deep analysis
- `SpeakingResults` — waveform, word-level colouring, bands, named fluency cause

---

## Not yet built

### Student screens (UX spec §3)

| Route | Screen | Notes |
|---|---|---|
| `/login` | Login | No self-signup; admin-provisioned credentials |
| `/dashboard` | Dashboard | **The product's headline.** Blocking-skill callout, four skill lines with CLB + gap, real-score capture card, first-login empty state |
| `/practice` | Practice selection | Recommendation panel with impact table, then all 19 types, filters |
| `/practice/[type]/drill` | Drill setup | Run-length picker (5/10/20/50, max 5 for the expensive types) |
| `/results/[attemptId]` | Results — deterministic types | Reading/Listening results; correct/total, no trait bars |
| `/results/[attemptId]` | Results — remaining scored types | SWT, SST, Describe Image, Respond to a Situation |
| `/mocks` | Mock list | Available + admin-assigned |
| `/mock/[id]/check` | Mic and audio check | Required before a mock starts |
| `/mock/[id]/run` | Mock runner | **Mock-mode chrome differs:** item counter, section timer, auto-advance, no pause |
| `/mock/[id]/report` | Mock report | Summary first, six sections, detail behind clicks |
| `/progress` | Progress | Trends, per-type accuracy by impact, writing error breakdown, CLB-9 bars |

### Admin screens (8)

`/admin` monitoring home · `/admin/users` · `/admin/questions` · `/admin/questions/import` · `/admin/mocks` mock builder · `/admin/flags` · `/admin/spend` · `/admin/audit`

### Cross-cutting, not yet designed

- **Mock-mode chrome** — the item counter and section timer variant of every runner
- **Untimed toggle** for standard mode
- **Sub-1024px block message** for Writing and Speaking
- **Estimate disclosure** — the required "how is this estimated?" wording appears as a link on the results screens but the explainer itself is unwritten
- **Trademark footer** — PRD §12 recommends it before launch; client deferred

---

## Open questions from the PRD that affect design

1. **Launch bank volume** (~950 vs ~300 items) — changes what the practice selection and question bank screens need to handle
2. **Five sample questions per type** — the runners currently use content I wrote; real items will replace it
