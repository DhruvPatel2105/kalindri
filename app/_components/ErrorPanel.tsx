"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a student sees if a page fails to load: a plain explanation, a retry
 * button and a way home — instead of a blank or crashed screen. Saved answers
 * are never affected by a page failing to load, and it says so.
 */
export function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Leave a trace for debugging; the student sees the friendly panel.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-[#f4f2ee] px-4 py-16">
      <div role="alert" className="mx-auto flex max-w-md flex-col gap-4 rounded-lg border border-[#ddd9d0] bg-white p-6">
        <h1 className="text-lg font-semibold text-[#1e2a2a]">Something went wrong loading this page</h1>
        <p className="text-sm text-[#5c6a68]">
          It may be a temporary connection problem. Your saved answers and results are safe.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-[#1f6f6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17544f]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded border border-[#dcd8cf] bg-white px-4 py-2 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
          >
            Go to the dashboard
          </Link>
        </div>
        {error.digest ? <p className="text-[11px] text-[#9aa39f]">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
