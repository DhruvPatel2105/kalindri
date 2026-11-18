import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/requireActiveSession";
import { getDb } from "@/lib/db";
import { getQuestionSetPage } from "@/lib/practice/listQuestionSets";
import {
  DIFFICULTY_LABELS,
  parsePageParam,
  questionCountLabel,
  type Difficulty,
} from "@/lib/practice/questionList";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { Pagination } from "../Pagination";
import { TYPE_LABELS } from "./typeLabels";

/**
 * Browse page for one question type: every published set, 10 per page, with a
 * difficulty tag, the number of questions in the set and a Start Practice
 * link (Continue, if the student has an unfinished attempt at it).
 *
 * CLAUDE.md content protection: this lists METADATA only — id, title,
 * difficulty, question count. The query (lib/practice/listQuestionSets.ts)
 * never reads question content, so no passage text or answer key reaches
 * this page. A set's questions are loaded by the test runner at
 * /practice/[type]/[setId], for the set the student chose.
 */

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  easy: "bg-[#e3f0ec] text-[#17544f]",
  medium: "bg-[#f5ecd3] text-[#7a5d14]",
  hard: "bg-[#f3dcd5] text-[#8a3622]",
};

export default async function PracticeBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { type } = await params;
  const { page: pageParam } = await searchParams;

  const user = await requireActiveSession();

  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    notFound();
  }
  const questionType = type as QuestionType;
  const label = TYPE_LABELS[questionType] ?? questionType;

  const { total, pagination, items } = await getQuestionSetPage(getDb(), {
    orgId: user.orgId,
    userId: user.id,
    type: questionType,
    requestedPage: parsePageParam(pageParam),
  });
  const { page, totalPages } = pagination;

  const pageHref = (n: number) =>
    n === 1 ? `/practice/${type}` : `/practice/${type}?page=${n}`;

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <header className="border-b border-[#e6e2d9] bg-white px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            ← Back
          </Link>
          <span className="text-[#ddd9d0]">|</span>
          <span className="text-sm font-semibold text-[#1e2a2a]">{label}</span>
          <Link
            href="/practice/history"
            className="ml-auto text-sm font-medium text-[#5c6a68] hover:text-[#1f6f6b]"
          >
            Practice history
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1e2a2a]">{label}</h1>
          <p className="mt-1 text-sm text-[#5c6a68]">
            {total === 0
              ? "No question sets are available yet."
              : `${total} question ${total === 1 ? "set" : "sets"} — choose one to practise.`}
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
                    {item.difficulty ? (
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${DIFFICULTY_STYLES[item.difficulty]}`}
                      >
                        {DIFFICULTY_LABELS[item.difficulty]}
                      </span>
                    ) : (
                      <span className="rounded bg-[#eceae4] px-2 py-0.5 font-medium text-[#5c6a68]">
                        Unrated
                      </span>
                    )}
                    <span className="text-[#5c6a68]">
                      {questionCountLabel(item.questionCount)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/practice/${type}/${item.id}`}
                  className="shrink-0 rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f]"
                >
                  {item.inProgress ? "Continue" : "Start Practice"}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
      </main>
    </div>
  );
}
