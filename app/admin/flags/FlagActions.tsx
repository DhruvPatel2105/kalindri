"use client";

import { useState, useTransition } from "react";

import { dismissFlagAction, resolveFlagAction } from "./actions";

export function FlagActions({ flagId }: { flagId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    setError(null);
    startTransition(async () => {
      try {
        await resolveFlagAction(flagId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update flag.",
        );
      }
    });
  }

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      try {
        await dismissFlagAction(flagId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update flag.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleResolve}
          disabled={isPending}
          className="rounded border border-[#1f6f6b] px-3 py-1 text-xs font-medium text-[#1f6f6b] hover:bg-[#1f6f6b] hover:text-white disabled:opacity-60"
        >
          {isPending ? "Working…" : "Mark reviewed"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="rounded border border-[#7d8a88] px-3 py-1 text-xs font-medium text-[#7d8a88] hover:bg-[#7d8a88] hover:text-white disabled:opacity-60"
        >
          {isPending ? "Working…" : "Dismiss"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#b0472f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
