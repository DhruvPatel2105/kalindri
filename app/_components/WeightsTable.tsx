import Link from "next/link";

import { QUESTION_TYPE_LABELS, OFFICIAL_QUESTION_COUNTS } from "@/lib/questions/labels";
import type { QuestionType, Skill } from "@/lib/questions/types";
import {
  formatWeight,
  groupWeights,
  SCORE_WEIGHT_DISCLOSURE,
  SKILL_LABELS,
  SKILL_ORDER,
  type WeightRow,
} from "@/lib/scoring/derivedWeights";

/** Rows in the order of the cross-scoring map. */
const ROWS: readonly QuestionType[] = [
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "DESCRIBE_IMAGE",
  "RESPOND_TO_SITUATION",
  "ANSWER_SHORT_QUESTION",
  "SUMMARIZE_WRITTEN_TEXT",
  "WRITE_EMAIL",
  "FIB_RW",
  "MCM_READING",
  "REORDER_PARAGRAPH",
  "FIB_READING",
  "MCS_READING",
  "SUMMARIZE_SPOKEN_TEXT",
  "MCM_LISTENING",
  "FIB_LISTENING",
  "MCS_LISTENING",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "WRITE_FROM_DICTATION",
];

const LIVE: readonly QuestionType[] = ["REORDER_PARAGRAPH", "FIB_RW", "FIB_READING", "MCS_READING", "MCM_READING"];

/** Weight bars are scaled to the biggest weight (Repeat Sentence in Speaking, 42.4%). */
const BAR_MAX = 45;

/**
 * "How much each question type counts" on the home page: the biggest levers
 * per skill, and the full task-by-skill map with Pearson's official question
 * counts. The numbers are OUR derivation (read from `skill_weights`), not
 * Pearson's, and the section says so.
 */
export function WeightsTable({
  rows,
  methodNote,
}: {
  rows: readonly WeightRow[];
  methodNote: string | null;
}) {
  if (rows.length === 0) return null;

  const grouped = groupWeights(rows);
  const cell = new Map(rows.map((r) => [`${r.questionType}/${r.skill}`, r.weightPct]));

  return (
    <section aria-labelledby="weights-heading" className="mb-10 flex flex-col gap-5">
      <div>
        <h2 id="weights-heading" className="text-lg font-semibold text-[#1e2a2a]">
          What each question type is worth
        </h2>
        <p className="mt-1 text-sm text-[#5c6a68]">
          How much each question type contributes to each skill&apos;s score. Some tasks count toward two
          skills, so practising them pays twice.
        </p>
      </div>

      {/* biggest levers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SKILL_ORDER.map((skill: Skill) => {
          const top = [...grouped[skill]].sort((a, b) => b.weightPct - a.weightPct).slice(0, 3);
          return (
            <div key={skill} className="rounded border border-[#ddd9d0] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">
                {SKILL_LABELS[skill]} · biggest levers
              </p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {top.map((entry) => (
                  <li key={entry.questionType} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-[#1e2a2a]">{QUESTION_TYPE_LABELS[entry.questionType]}</span>
                    <span className="flex-none rounded bg-[#fdecea] px-2 py-0.5 text-[11px] font-semibold text-[#b0472f]">
                      {formatWeight(entry.weightPct)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {/* the full map */}
      <div className="overflow-x-auto rounded border border-[#ddd9d0] bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Score weight of each question type toward each skill, with the official number of questions per test
          </caption>
          <thead>
            <tr className="border-b border-[#e6e2d9] bg-[#fafaf8] text-left text-xs uppercase tracking-wide text-[#5c6a68]">
              <th scope="col" className="px-4 py-3 font-semibold">Task</th>
              <th scope="col" className="px-3 py-3 text-center font-semibold">Questions</th>
              {SKILL_ORDER.map((skill) => (
                <th key={skill} scope="col" className="px-3 py-3 text-center font-semibold">
                  {SKILL_LABELS[skill]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((type) => (
              <tr key={type} className="border-b border-[#f0ede5] last:border-b-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-[#1e2a2a]">
                  {LIVE.includes(type) ? (
                    <Link href={`/practice/${type}`} className="hover:text-[#1f6f6b] hover:underline">
                      {QUESTION_TYPE_LABELS[type]}
                    </Link>
                  ) : (
                    <span className="text-[#5c6a68]">{QUESTION_TYPE_LABELS[type]}</span>
                  )}
                  {type === "MCM_READING" || type === "MCS_READING" ? (
                    <span className="ml-1 text-[11px] font-normal text-[#9aa39f]">(Reading)</span>
                  ) : type === "MCM_LISTENING" || type === "MCS_LISTENING" ? (
                    <span className="ml-1 text-[11px] font-normal text-[#9aa39f]">(Listening)</span>
                  ) : null}
                </th>
                <td className="px-3 py-2.5 text-center text-xs text-[#5c6a68]">{OFFICIAL_QUESTION_COUNTS[type]}</td>
                {SKILL_ORDER.map((skill) => {
                  const pct = cell.get(`${type}/${skill}`);
                  return (
                    <td key={skill} className="px-3 py-2.5">
                      {pct === undefined ? (
                        <span className="block text-center text-[#c9c6bd]" aria-label="not applicable">
                          —
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-[#f0ede5]" aria-hidden="true">
                            <div
                              className="h-full rounded-full bg-[#1f6f6b]"
                              style={{ width: `${Math.min(100, (pct / BAR_MAX) * 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs font-semibold tabular-nums text-[#1e2a2a]">
                            {formatWeight(pct)}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-[#7d8a88]">{SCORE_WEIGHT_DISCLOSURE}</p>
        {methodNote ? (
          <details className="text-xs text-[#5c6a68]">
            <summary className="cursor-pointer font-medium text-[#1f6f6b]">How is this calculated?</summary>
            <p className="mt-2 max-w-3xl leading-relaxed">{methodNote}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
