# Kalindri — project rules

## Score display

- **An estimated range must sit entirely within the CLB band it claims.** Never let a
  range straddle a band boundary. If the underlying estimate does straddle one, either
  narrow it or report the lower band — do not label a range with a band it only
  partly occupies.
- Scores are always a CLB band **plus** a range, labelled as estimated. Never a single number.
- CLB 9 floors (PTE Core): Listening 82, Reading 78, Speaking 84, Writing 88.
  Writing CLB 8 is 79–87; CLB 9 is compressed into 88–89.
- Show each skill's CLB 9 floor on its bar, not only the blocking skill's.
  Distinguish *comfortably met* from *sitting on the boundary* — a range whose floor
  equals the CLB 9 threshold is one weak session from becoming blocking, and a plain ✓ hides that.
- Below 5 attempts on a task type, show "needs more data" rather than a number.

## Task weights

- Weights come from `02-scoring-spec.md` §10 (derived model). Writing:
  Write Email 26.6, Write from Dictation 22.3, R&W Fill in the Blanks 19.5,
  Listening Fill in the Blanks 12.4, Summarize Spoken Text 10.6, Summarize Written Text 8.5.
- Rank recommendations by **weight × headroom × confidence**, and show the arithmetic
  in the "why" column. If the UI claims a derivation, the numbers must be that derivation.
- Weights are our derivation from Pearson's published question counts and rubric maximums.
  Never describe them as published by Pearson.
- The CLB alignment table **is published by Pearson and used by IRCC** for Express Entry.
  Never say IRCC publishes it.

## Framing (non-negotiable — these users are under immigration pressure)

- No probability-of-success prediction, no countdown to a test date.
- No peer comparison, leaderboards, or class averages. Self-referenced progress only.
- Every number on screen has an action next to it, or it does not appear.

## Build

- Design Components only. Palette: teal `#1f6f6b`, deep teal `#17544f`, paper `#f4f2ee`,
  ink `#1e2a2a`, muted `#5c6a68` / `#7d8a88`, card white on `#ddd9d0`, panel `#fafaf8`,
  amber `#b58b2a` / `#8a6a1e`, rust `#b0472f`. Libre Franklin + IBM Plex Mono.
- Body text at or above `#5c6a68` on white/paper; `#7d8a88` for incidental labels only.
