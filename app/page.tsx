import Link from "next/link";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getLibraryCounts } from "@/lib/practice/libraryCounts";
import type { QuestionType } from "@/lib/questions/types";

import { loadWeights } from "@/lib/scoring/loadWeights";
import { weightSummary, SCORE_WEIGHT_DISCLOSURE } from "@/lib/scoring/derivedWeights";

import { AppNav } from "./_components/AppNav";
import { WeightsTable } from "./_components/WeightsTable";
import { ProgressOverview } from "./ProgressOverview";

// ─── question type cards shown on the Reading section ────────────────────────

const READING_TYPES = [
  {
    type: "REORDER_PARAGRAPH",
    label: "Reorder Paragraph",
    part: "Part 2 — Reading",
    description:
      "Five jumbled sentences. Drag them into the correct logical order. Scored on adjacent pairs — one sentence out of place costs less than a fully reversed sequence.",
    scoring: "Adjacent pairs",
    icon: "⇅",
    accent: "#1f6f6b",
  },
  {
    type: "FIB_RW",
    label: "R&W Fill in the Blanks",
    part: "Part 1 — Speaking & Writing",
    description:
      "A passage with dropdown menus at each gap. Pick the word that fits both the grammar and the meaning of the sentence. One mark per blank, no penalties.",
    scoring: "1 pt per blank",
    icon: "▾",
    accent: "#2d6fa3",
  },
  {
    type: "FIB_READING",
    label: "Reading Fill in the Blanks",
    part: "Part 2 — Reading",
    description:
      "A passage with gaps and a word bank below. Drag each word into the right gap. The bank has more words than gaps — choose carefully. One mark per correct placement.",
    scoring: "1 pt per blank",
    icon: "⤵",
    accent: "#5a4fcf",
  },
] as const;

// Multiple-choice Reading types: shown only once they have a published set, and
// with no weight line — docs/02-scoring-spec.md §10 has no derived weight for them.
const MULTIPLE_CHOICE_TYPES = [
  {
    type: "MCS_READING",
    label: "Multiple Choice (Single)",
    part: "Part 2 — Reading",
    description:
      "Read a passage and choose the one best answer to the question. Marked right or wrong.",
    scoring: "1 pt per question",
    icon: "◉",
    accent: "#a3622d",
  },
  {
    type: "MCM_READING",
    label: "Multiple Choice (Multiple)",
    part: "Part 2 — Reading",
    description:
      "Read a passage and select every correct answer. Each correct choice earns a mark and each wrong one loses a mark, never going below zero.",
    scoring: "+1 correct, −1 incorrect",
    icon: "☑",
    accent: "#8a4f8f",
  },
] as const;

type TypeCard = {
  type: QuestionType;
  label: string;
  part: string;
  description: string;
  scoring: string;
  icon: string;
  accent: string;
};

// ─── skill context strip ──────────────────────────────────────────────────────

const SKILL_NOTES = [
  { skill: "Reading", note: "" }, // note filled in from the live card count
  { skill: "Writing", note: "Coming soon." },
  { skill: "Speaking", note: "Coming soon." },
  { skill: "Listening", note: "Coming soon." },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const appUser = await requireActiveSession();

  const counts = await getLibraryCounts(getDb(), appUser.orgId);
  const { rows: weightRows, methodNote } = await loadWeights(appUser.orgId);
  const cards: TypeCard[] = [
    ...READING_TYPES,
    ...MULTIPLE_CHOICE_TYPES.filter((qt) => (counts.get(qt.type)?.sets ?? 0) > 0),
  ];
  const totalQuestions = cards.reduce(
    (sum, qt) => sum + (counts.get(qt.type)?.questions ?? 0),
    0,
  );
  const typeWord = cards.length === 1 ? "type" : "types";

  const firstName = appUser.email.split("@")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-[#f4f2ee] pb-16 text-[#1e2a2a]">

      <AppNav />

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
            {cards.length} Reading question {typeWord} {cards.length === 1 ? "is" : "are"} available below —{" "}
            {totalQuestions} questions in total. Speaking, Writing and Listening
            are coming next.
          </p>
        </div>

        {/* ── your progress (saved practice sessions) ── */}
        <ProgressOverview user={appUser} />

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
                  {skill === "Reading"
                    ? `${cards.length} ${typeWord} available to practise now.`
                    : note}
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
          <span className="text-sm text-[#7d8a88]">{totalQuestions} questions</span>
        </div>

        {/* ── question type cards ── */}
        <div className="flex flex-col gap-4">
          {cards.map((qt) => (
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
                    {weightSummary(weightRows, qt.type) ? (
                      <span className="text-xs text-[#7d8a88]">
                        <span className="font-semibold text-[#5c6a68]">Weight</span>{" "}
                        {weightSummary(weightRows, qt.type)}
                      </span>
                    ) : null}
                    <span className="text-xs text-[#7d8a88]">
                      <span className="font-semibold text-[#5c6a68]">Scoring</span>{" "}
                      {qt.scoring}
                    </span>
                    <span className="text-xs text-[#7d8a88]">
                      <span className="font-semibold text-[#5c6a68]">Bank</span>{" "}
                      {counts.get(qt.type)?.questions ?? 0} questions ·{" "}
                      {(counts.get(qt.type)?.sets ?? 0) === 0
                        ? "no sets yet"
                        : `${counts.get(qt.type)?.sets} ${counts.get(qt.type)?.sets === 1 ? "set" : "sets"}`}
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
                  <Link
                    href={`/practice/${qt.type}/progress`}
                    className="ml-3 text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
                  >
                    Progress
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <WeightsTable rows={weightRows} methodNote={methodNote} />
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
                body: "Reading types are scored automatically the moment you submit a test — no AI, no waiting.",
              },
              {
                title: "Review after you submit",
                body: "Sit the whole set, then go through each question: your answer beside the correct one, green for right and red for wrong. Questions you left blank are flagged too.",
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
          {SCORE_WEIGHT_DISCLOSURE} Kalindri is not affiliated with or endorsed by Pearson.
        </p>
      </div>
    </div>
  );
}
