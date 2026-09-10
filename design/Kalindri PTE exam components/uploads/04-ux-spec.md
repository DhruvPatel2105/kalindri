# UX Specification

**Revision 2** — score display reordered to lead with CLB bands rather than a 10–90 number,
following research confirming no public trait-to-scale conversion exists. Adds real-score
capture and speaking-feedback requirements.

---

## 1. Platform and design direction

**Desktop-first.** Minimum 1024px, matching typical test-centre monitors.
Mobile permitted for Reading and Listening **review only**. Writing and Speaking are
blocked below 1024px with a clear explanatory message — practising Speaking on a phone mic
teaches habits that do not transfer.

**Chrome only in V1.** Speaking depends on browser audio APIs that behave differently
across engines; supporting three browsers roughly doubles testing work in that module.

**Design brief:** match the real exam's **structure and flow** — element positions, timer
placement, button order, screen sequence — so students build genuine familiarity. Shift
positions slightly and use a distinct but adjacent colour palette so the product is
visibly Kalindri's, not a reproduction of Pearson's interface. Feel identical; look like
its own product.

**Watermark:** student email, low opacity, on all question screens.

---

## 2. Three practice modes

| Mode | Timer | Feedback | Use |
|---|---|---|---|
| **Standard** | Real exam timer, with untimed toggle | Immediately after each question | Learning a type |
| **Drill** | Real timer | All results at the end | Volume training |
| **Mock** | Enforced section timers, auto-advance | Report after batch scoring | Exam simulation |

### Drill mode sizing

Run lengths vary by type, because a 50-question Write Email drill would take four hours
and cost real money.

- **5 / 10 / 20 / 50:** Repeat Sentence, Read Aloud, Write from Dictation,
  Answer Short Question, Select Missing Word
- **Maximum 5:** Write Email, SWT, SST, Describe Image, Respond to a Situation

Drill runs straight through with no menu return, exactly like the exam, then presents all
results together.

---

## 3. Screen inventory

### Student

```
/login
/dashboard
/practice                      type selection: recommendation on top, full list below
/practice/[type]               standard mode runner
/practice/[type]/drill         drill setup then runner
/results/[attemptId]           per-attempt feedback
/mocks                         available and assigned mocks
/mock/[id]/check               mic and audio check
/mock/[id]/run                 the exam
/mock/[id]/report              full score report
/progress                      history, trends, per-type accuracy
```

### Admin

```
/admin                         monitoring home
/admin/users                   list, create, deactivate, reset password, impersonate
/admin/questions               list, filter, create, edit, preview, disable
/admin/questions/import        sheet import with validation
/admin/mocks                   mock builder
/admin/flags                   sharing alerts + score flags
/admin/spend                   AI cost analytics
/admin/audit                   audit log
```

---

## 4. Student dashboard

**The headline is not a score.** It is the blocking skill.

```
┌────────────────────────────────────────────────────┐
│  Writing is holding you at CLB 8                   │
│  You're at 79. CLB 9 needs 88.                     │
│  → Highest-impact practice: Write from Dictation   │
└────────────────────────────────────────────────────┘

Listening   82–86  ·  CLB 9  ·  ✓ target met
Reading     78–83  ·  CLB 9  ·  ✓ target met
Speaking    84–88  ·  CLB 9  ·  ✓ target met
Writing     76–82  ·  CLB 8  ·  ~9 points to CLB 9   ← blocking

[ Recommended practice ]    [ Take a mock ]    [ Progress ]
```

Every skill line reads: **estimated range · CLB · gap to CLB 9**. The gap is the
information. A student does not care about 79; they care that they are CLB 8 and need 88.

**Ranges, not point estimates.** All estimated figures carry a visible "estimated" label and
a link explaining the derivation. The CLB band is the more reliable output and should be
read as the primary signal.

**Weight disclosure.** Wherever task-impact percentages appear, a "how is this calculated?"
link must state that weights are derived from official question counts and rubric maximums
and are not published by Pearson. Never imply the weights are official.

### Report your real exam score

A persistent, low-key card on the dashboard: *"Sat the real test? Add your official scores."*

Captures the four official skill scores and test date into `reported_real_scores`. This is
the highest-value data in the system — it is what lets you eventually publish a real
validation study, which research confirmed no competitor has done. Every rival's accuracy
claim is unsubstantiated marketing.

Frame it as helping the student's own future estimates improve, which is also true.

### First login, before any data

The recommendation engine has nothing to work with, so offer two paths:

1. **Recommended:** take a mock to establish a baseline across all four skills
2. **Alternative:** start immediately with the three highest-impact types —
   Repeat Sentence, Read Aloud, Write from Dictation

One mock makes every subsequent recommendation dramatically more accurate. Present it as
the default, with the practice shortcut beneath.

---

## 5. Practice selection screen

Recommended action at the top, full list of all 19 types below.

The recommendation panel shows the priority table directly:

```
Because Writing is blocking your CLB:

  Write from Dictation      27% of Writing   you're at 61%   ★ start here
  Write Email               28% of Writing   you're at 78%
  Summarize Spoken Text     11% of Writing   needs 5 attempts
  Listening Fill in Blanks   7% of Writing   you're at 84%
```

Types below the 5-attempt confidence threshold show "needs more data" rather than a
ranking.

Filters: difficulty, topic, accent. Default is next question from the pool.

---

## 6. Results screen — Write Email

Ordering, top to bottom:

1. **Header:** `11/15 · estimated CLB 8 · roughly 76–82`

   The trait total leads because it is real, rubric-derived data. The scaled figure is a
   **range, never a point estimate** — no official or peer-reviewed raw-to-90 conversion
   exists, and a point estimate fakes precision we do not have. Competitors show point
   estimates and their users report divergences of 10–30 points. A "how is this estimated?"
   link explains the derivation.
2. **Seven-trait bar chart**, each showing the band descriptor achieved
3. **Their text, annotated inline** — spelling and grammar issues highlighted, hover for
   explanation
4. **Per-trait written feedback**, naming missed bullet points explicitly:
   *"You did not address the deadline in bullet point 3."* Each trait includes one thing
   done well alongside the fix
5. **Comparison to previous attempts** on this type
6. **[ Reveal model answer ]** — never shown before feedback is read
7. **[ Run deep analysis ]** — second AI call, on demand

Deep analysis is on-demand in practice mode (cost control) and **generated by default** in
mock mode (already in the batch, ready when the report is).

Tone: direct but not cold. These are adults under real immigration pressure.

---

## 7. Results screen — Speaking

- Waveform with **student's own audio playable**
- **Word-level pronunciation colouring** from Azure, so a student can hear themselves say
  the exact word flagged
- Fluency and pronunciation band scores with descriptors
- Content or appropriacy score where applicable
- Model audio for comparison (Read Aloud)

**Fluency feedback must name its cause.** Never show a low fluency score alone. State
whether it was pace, pausing, hesitation or repetition, and where.

**Never coach toward robotic delivery.** Research identified a competitor whose scoring
effectively rewards reading one word at a time, teaching a habit that lowers real exam
scores. Guidance here should encourage natural connected speech, and the scorer must be
regression-tested to confirm a deliberately robotic reading does not outscore a natural one.

Speaking-score unreliability is the most cited complaint across every competitor. This
screen is where trust is won or lost.

---

## 8. Mock test flow

```
/mock/[id]/check     mic + audio check              ← required, as in the real exam
/mock/[id]/run       Part 1 → Part 2 → Part 3
/mock/[id]/report    after batch scoring
```

**Rules:**

- **No pause.** The real exam has none.
- **Crash-resume.** A browser refresh or accidental close resumes at the exact item.
  `sessions.state` autosaves every few seconds.
- **Enforced section timers with auto-advance** on expiry.
- **Progress indicator visible** — item counter and section timer, as the real exam shows.
- **No editing after submission.**
- **No feedback during the test.**

### Report delivery

On submit, all LLM scoring queues into a **single Batch API call** (50% discount, typically
under an hour). Speech assessment has already run per-item during the test, so it is
complete on submission.

Student sees "your report is being prepared", typical wait 10–30 minutes, and receives an
**email via Resend** when ready. They can close the tab safely.

### Report structure — summary first, detail behind clicks

1. Four skill scores with estimated CLB per skill
2. Blocking-skill callout
3. Per-section breakdown with accuracy per question type
4. Prioritised recommendations (weight × headroom)
5. Deep analysis per AI-scored item — generated by default
6. Per-question review, behind a click

Dumping 60 items at once buries the thing that matters.

---

## 9. Progress screen

- Score trend per skill over time, with attempt counts
- Accuracy per question type, ranked by impact rather than by raw score
- **Writing error breakdown** — how much score is lost to spelling vs grammar vs content
  coverage vs form. Most students have no idea which one is costing them.
- Full attempt history, any past attempt reopenable with its original feedback
- Progress bars toward CLB 9 per skill

### Motivation mechanics

**Included:** progress-to-CLB-9 bars, personal best markers per type, milestone notices on
crossing a CLB band, self-set weekly practice target, activity calendar presented as
information.

**Excluded:** streaks (a broken streak is a guilt mechanic, and these users have enough
pressure), leaderboards (ranking PR applicants against each other would be unkind and
demoralising).

---

## 10. Admin screens

### Monitoring home

Immediate: active students today · attempts today · AI spend today, this week, this month ·
open account flags · failed scoring jobs · open score flags.

Trends: spend per day and per week, spend per student, attempts per type, students inactive
7+ days, questions with unusual failure rates.

### Notifications — three tiers

Notifying on everything means ignoring everything. Fifty emails in a bad hour trains you
to stop reading them.

- **Immediate email:** spend threshold crossed · scoring queue stuck · database or auth
  errors · a mock that failed to score
- **Daily digest email:** flagged accounts · failed imports · questions failing unusually
  often · yesterday's spend and activity
- **Dashboard only:** individual retries · single failures that succeeded on retry ·
  routine events

### User management

Create-user form: name, email, auto-generated password shown once, active/inactive toggle,
notes. Plus a **copy-credentials button** that formats login details for pasting into
WhatsApp. Small feature, meaningful time saving when onboarding by hand.

Password reset regenerates and copies, same flow.
Impersonation ("view as student") available and **fully audit-logged**.
Aggregate scores visible; individual response text and audio not routinely browsable.

### Question bank

- List with filters by type, status, difficulty, accent
- **Preview renders in the exact student component**, not an approximation
- **Instant disable toggle** — removes from all pools including assembled mocks, past
  attempts stay valid
- Per-question stats: attempt count, average score, flag count
- Import: **reject-all on validation failure**, with per-row error reporting. Partial
  imports create confusing half-states.

### Mock builder

- Per-type counts prefilled from the official blueprint
- Live validation: *"Repeat Sentence: 10–12 required, you have selected 4"*
- Cannot save an invalid mock
- Search and filter the bank by type, difficulty, topic; click to add
- **"Fill remaining randomly"** button — hand-picking 60 items every time wears you down
  even when you want control over some of them
- Assign to named students; admin-built mocks are invisible to everyone else
