import Link from "next/link";

import { logout } from "@/lib/auth/actions";
import { requireActiveSession } from "@/lib/auth/requireActiveSession";

// ─── question type cards shown on the Reading section ────────────────────────

const READING_TYPES = [
  {
    type: "REORDER_PARAGRAPH",
    label: "Reorder Paragraph",
    part: "Part 2 — Reading",
    weight: "9.4% of Reading",
    description:
      "Five jumbled sentences. Drag them into the correct logical order. Scored on adjacent pairs — one sentence out of place costs less than a fully reversed sequence.",
    count: 18,
    scoring: "Adjacent pairs",
    icon: "⇅",
    accent: "#1f6f6b",
  },
  {
    type: "FIB_RW",
    label: "R&W Fill in the Blanks",
    part: "Part 1 — Speaking & Writing",
    weight: "19.5% of Writing · 25.8% of Reading",
    description:
      "A passage with dropdown menus at each gap. Pick the word that fits both the grammar and the meaning of the sentence. One mark per blank, no penalties.",
    count: 15,
    scoring: "1 pt per blank",
    icon: "▾",
    accent: "#2d6fa3",
  },
  {
    type: "FIB_READING",
    label: "Reading Fill in the Blanks",
    part: "Part 2 — Reading",
    weight: "21.1% of Reading",
    description:
      "A passage with gaps and a word bank below. Drag each word into the right gap. The bank has more words than gaps — choose carefully. One mark per correct placement.",
    count: 63,
    scoring: "1 pt per blank",
    icon: "⤵",
    accent: "#5a4fcf",
  },
] as const;

// ─── skill context strip ──────────────────────────────────────────────────────

const SKILL_NOTES = [
  { skill: "Reading", note: "Three types available to practice now." },
  { skill: "Writing", note: "Coming soon." },
  { skill: "Speaking", note: "Coming soon." },
  { skill: "Listening", note: "Coming soon." },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const appUser = await requireActiveSession();

  const firstName = appUser.email.split("@")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-[#f4f2ee] pb-16 text-[#1e2a2a]">

      {/* ── top nav ── */}
      <header className="flex items-center justify-between gap-6 px-8 py-5 md:px-12">
        <span className="text-2xl font-semibold tracking-tight text-[#17544f]">
          Kalindri
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#7d8a88]">{appUser.email}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded border border-[#dcd8cf] bg-white px-4 py-2 text-sm font-medium text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 md:px-12">

        {/* ── greeting ── */}
        <div className="mb-8 mt-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[#17544f]">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1.5 text-sm text-[#7d8a88]">
            Targeting CLB 9 · Reading module available
          </p>
        </div>

        {/* ── notice banner ── */}
        <div className="mb-8 rounded border border-[#bcd6d3] bg-[#eaf2f1] px-5 py-4">
          <p className="text-sm leading-relaxed text-[#17544f]">
            <span className="font-semibold">Reading is live.</span>{" "}
            All three Reading question types are available below — 96 questions
            in total. Speaking, Writing and Listening are coming next.
          </p>
        </div>

        {/* ── skill status strip ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SKILL_NOTES.map(({ skill, note }) => {
            const isLive = skill === "Reading";
            return (
              <div
                key={skill}
                className={`rounded border px-4 py-3 ${
                  isLive
                    ? "border-[#bcd6d3] bg-white"
                    : "border-[#e6e2d9] bg-[#fafaf8]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isLive ? "text-[#1e2a2a]" : "text-[#9aa39f]"
                    }`}
                  >
                    {skill}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isLive
                        ? "bg-[#eaf2f1] text-[#17544f]"
                        : "bg-[#f0ede5] text-[#9aa39f]"
                    }`}
                  >
                    {isLive ? "Live" : "Soon"}
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    isLive ? "text-[#5c6a68]" : "text-[#adb4b1]"
                  }`}
                >
                  {note}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── section heading ── */}
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#1e2a2a]">
            Reading — practice by type
          </h2>
          <span className="text-sm text-[#7d8a88]">96 questions · ranked by weight</span>
        </div>

        {/* ── question type cards ── */}
        <div className="flex flex-col gap-4">
          {READING_TYPES.map((qt) => (
            <div
              key={qt.type}
              className="overflow-hidden rounded border border-[#ddd9d0] bg-white"
              style={{ borderLeft: `4px solid ${qt.accent}` }}
            >
              <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">

                {/* left: info */}
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded text-base"
                      style={{ background: `${qt.accent}18`, color: qt.accent }}
                    >
                      {qt.icon}
                    </span>
                    <span className="text-base font-semibold text-[#1e2a2a]">
                      {qt.label}
                    </span>
                    <span className="rounded border border-[#e6e2d9] bg-[#fafaf8] px-2 py-0.5 text-xs text-[#5c6a68]">
                      {qt.part}
                    </span>
                  </div>

                  <p className="max-w-xl text-sm leading-relaxed text-[#5c6a68]">
                    {qt.description}
                  </p>

                  <div className="flex flex-wrap gap-4 pt-0.5">
                    <span className="text-xs text-[#7d8a88]">
                      <span className="font-semibold text-[#5c6a68]">Weight</span>{" "}
                      {qt.weight}
                    </span>
                    <span className="text-xs text-[#7d8a88]">
                      <span className="font-semibold text-[#5c6a68]">Scoring</span>{" "}
                      {qt.scoring}
                    </span>
                    <span className="text-xs text-[#7d8a88]">
                      <span className="font-semibold text-[#5c6a68]">Bank</span>{" "}
                      {qt.count} questions
                    </span>
                  </div>
                </div>

                {/* right: cta */}
                <div className="flex flex-none items-center sm:pl-6">
                  <Link
                    href={`/practice/${qt.type}`}
                    className="rounded px-6 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-90"
                    style={{ background: qt.accent }}
                  >
                    Practice →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── how scoring works ── */}
        <div className="mt-8 rounded border border-[#e6e2d9] bg-[#fafaf8] px-6 py-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5c6a68]">
            How scoring works
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Instant & deterministic",
                body: "All three Reading types are scored automatically the moment you submit — no AI, no waiting.",
              },
              {
                title: "Per-blank feedback",
                body: "After each attempt you see which blanks were right, which were wrong, and what the correct answer was.",
              },
              {
                title: "Adjacent-pair scoring for Reorder",
                body: "One point per correctly ordered neighbouring pair. One box out of place costs less than a fully reversed sequence.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[#1e2a2a]">
                  {title}
                </span>
                <span className="text-sm leading-relaxed text-[#5c6a68]">
                  {body}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── disclaimer ── */}
        <p className="mt-6 text-xs leading-relaxed text-[#9aa39f]">
          Weights are our derivation from Pearson&apos;s published question counts
          and rubric maximums — not official Pearson figures. Kalindri is not
          affiliated with or endorsed by Pearson.
        </p>
      </div>
    </div>
  );
}
