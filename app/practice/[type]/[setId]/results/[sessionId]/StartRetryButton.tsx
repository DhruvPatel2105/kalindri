"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startRetryAction } from "@/lib/practice/testActions";

/** Starts (or resumes) the retry of a finished test, then opens it. */
export function StartRetryButton({
  parentSessionId,
  type,
  setId,
  count,
}: {
  parentSessionId: string;
  type: string;
  setId: string;
  count: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startRetryAction(parentSessionId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/practice/${type}/${setId}/session/${result.sessionId}`);
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="w-fit rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-60"
      >
        {isPending ? "Starting…" : `Practise incorrect questions (${count})`}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
