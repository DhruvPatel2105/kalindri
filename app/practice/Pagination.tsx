import Link from "next/link";

import { pageNumbers } from "@/lib/practice/questionList";

const BUTTON =
  "rounded border border-[#ddd9d0] bg-white px-3 py-1.5 text-sm text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]";
const DISABLED = "rounded border border-[#e6e2d9] px-3 py-1.5 text-sm text-[#a8b0ae]";

/** Previous / numbered pages / Next as plain links. Renders nothing for a single page. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={BUTTON}>
          Previous
        </Link>
      ) : (
        <span className={DISABLED}>Previous</span>
      )}

      {pageNumbers(page, totalPages).map((n) =>
        n === page ? (
          <span
            key={n}
            aria-current="page"
            className="rounded bg-[#1f6f6b] px-3 py-1.5 text-sm font-semibold text-white"
          >
            {n}
          </span>
        ) : (
          <Link key={n} href={hrefFor(n)} className={BUTTON}>
            {n}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={BUTTON}>
          Next
        </Link>
      ) : (
        <span className={DISABLED}>Next</span>
      )}
    </nav>
  );
}
