"use client";

import { useState, useTransition } from "react";

import { toggleUserActiveAction } from "./actions";

export function ToggleActiveButton({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await toggleUserActiveAction(userId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update user.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          isActive
            ? "rounded border border-[#b0472f] px-3 py-1 text-xs font-medium text-[#b0472f] hover:bg-[#b0472f] hover:text-white disabled:opacity-60"
            : "rounded border border-[#1f6f6b] px-3 py-1 text-xs font-medium text-[#1f6f6b] hover:bg-[#1f6f6b] hover:text-white disabled:opacity-60"
        }
      >
        {isPending ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-[#b0472f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
