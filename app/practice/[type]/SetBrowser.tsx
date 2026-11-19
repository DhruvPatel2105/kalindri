import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getQuestionSetPage } from "@/lib/practice/listQuestionSets";
import {
  describeSetDifficulty,
  difficultyBreakdown,
  parsePageParam,
  questionCountLabel,
} from "@/lib/practice/questionList";
import { QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { DifficultyTag } from "../../_components/DifficultyTag";
import { Pagination } from "../Pagination";
import { StartTestControl } from "./StartTestControl";

/**
 * Browse page for one question type's sets, used for both ways of working
 * through a set:
 *   - "test"  (/practice/[type]/tests): sit the whole set and get a final score
 *   - "learn" (/practice/[type]/learn): Practice — all questions on one page,
 *     reveal answers and retry questions one at a time
 * Every published set, 10 per page, with a difficulty tag, the number of
 * questions and a start link (Continue, for a test the student left unfinished).
 *
 * CLAUDE.md content protection: this lists METADATA only — id, title,
 * difficulty, question count. The query (lib/practice/listQuestionSets.ts)
 * never reads question content, so no passage text or answer key reaches
 * this page.
 */

export type BrowseMode = "test" | "learn";

const MODES = {
  test: {
    segment: "tests",
    heading: (label: string) => `${label} — Tests`,
    blurb: "choose how many questions you want, then start a test and get your final score.",
    start: "Start test",
    link: (type: string, id: string) => `/practice/${type}/${id}`,
  },
  learn: {
    segment: "learn/sets",
    heading: (label: string) => `${label} — Practice`,
    blurb: "choose a set to practise, one question at a time.",
    start: "Practise",
    link: (type: string, id: string) => `/practice/${type}/learn/${id}`,
  },
} as const;


export async function SetBrowser({
  type,
  pageParam,
  mode,
}: {
  type: string;
  pageParam: string | string[] | undefined;
  mode: BrowseMode;
}) {
  const config = MODES[mode];

  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    notFound();
  }
  const questionType = type as QuestionType;
  const label = QUESTION_TYPE_LABELS[questionType];

  const { total, pagination, items } = await getQuestionSetPage(getDb(), {
    orgId: user.orgId,
    userId: user.id,
    type: questionType,
    requestedPage: parsePageParam(pageParam),
  });
  const { page, totalPages } = pagination;

  const pageHref = (n: number) =>
    n === 1
      ? `/practice/${type}/${config.segment}`
      : `/practice/${type}/${config.segment}?page=${n}`;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href={`/practice/${type}`}
            className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            ← Back
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
          {mode === "test" ? (
            <div className="ml-auto flex items-center gap-4">
              <Link
                href={`/practice/${type}/progress`}
                className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
              >
                Your progress
              </Link>
              <Link
                href="/practice/history"
                className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
              >
                Test history
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">{config.heading(label)}</h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            {total === 0
              ? "No question sets are available yet."
              : `${total} question ${total === 1 ? "set" : "sets"} — ${config.blurb}`}
          </p>
        </div>

        {items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#ddd9d0] bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1e2a2a]">
                    {item.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    {(() => {
                      const d = describeSetDifficulty(item.difficulty, item.difficultyMix);
                      return d.kind === "single" ? (
                        <DifficultyTag difficulty={d.difficulty} />
                      ) : d.kind === "mixed" ? (
                        <span
                          className="rounded bg-[#eceae4] px-2 py-0.5 font-medium text-[#3d4a48]"
                          title={difficultyBreakdown(item.difficultyMix)}
                        >
                          Mixed
                        </span>
                      ) : (
                        <DifficultyTag difficulty={null} />
                      );
                    })()}
                    <span className="text-[#5c6a68]">
                      {questionCountLabel(item.questionCount)}
                    </span>
                    {describeSetDifficulty(item.difficulty, item.difficultyMix).kind === "mixed" ? (
                      <span className="text-[#7d8a88]">{difficultyBreakdown(item.difficultyMix)}</span>
                    ) : null}
                  </div>
                </div>
                {mode === "test" && !item.inProgress ? (
                  <StartTestControl type={type} setId={item.id} total={item.questionCount} />
                ) : (
                  <Link
                    href={config.link(type, item.id)}
                    className="shrink-0 rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f]"
                  >
                    {mode === "test" ? "Continue" : config.start}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
      </main>
    </div>
  );
}
