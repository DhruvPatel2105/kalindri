"use client";

import { useState } from "react";

import type { BookmarkColor } from "@/lib/practice/bookmarkColors";

type Choice = BookmarkColor | null;

interface BookmarkChoice {
  value: Choice;
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: string | null;
  fill: string;
  stroke: string;
}

const NONE: BookmarkChoice = { value: null, label: "None", bg: "bg-white", border: "border-[#dcd8cf]", text: "text-[#9aa39f]", icon: null, fill: "none", stroke: "#9aa39f" };

const CHOICES: BookmarkChoice[] = [
  NONE,
  { value: "red", label: "Red", bg: "bg-[#fdf2f0]", border: "border-[#e8c4bc]", text: "text-[#b0472f]", icon: "🔴", fill: "#b0472f", stroke: "#b0472f" },
  { value: "orange", label: "Orange", bg: "bg-[#fdf6ed]", border: "border-[#e8d4a8]", text: "text-[#c47b1e]", icon: "🟠", fill: "#c47b1e", stroke: "#c47b1e" },
  { value: "yellow", label: "Yellow", bg: "bg-[#fdfbed]", border: "border-[#e6e08a]", text: "text-[#a09b1e]", icon: "🟡", fill: "#a09b1e", stroke: "#a09b1e" },
  { value: "green", label: "Green", bg: "bg-[#f4faf9]", border: "border-[#bcd6d3]", text: "text-[#1f6f6b]", icon: "🟢", fill: "#1f6f6b", stroke: "#1f6f6b" },
];

export function choiceFor(value: Choice): BookmarkChoice {
  return CHOICES.find((c) => c.value === value) ?? NONE;
}

/**
 * Bookmark picker: None, red, orange, yellow or green. Pass `value` and
 * `onChange` to control it (and save the choice yourself); without
 * `onChange` it just remembers the choice for the life of the page.
 */
export function BookmarkButton({
  value,
  onChange,
  disabled,
}: {
  value?: Choice;
  onChange?: (next: Choice) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState<Choice>(null);
  const [open, setOpen] = useState(false);

  const active = onChange ? (value ?? null) : local;
  const current = choiceFor(active);

  function choose(next: Choice) {
    if (onChange) onChange(next);
    else setLocal(next);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Bookmark this question"
        className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${current.bg} ${current.border} ${current.text}`}
      >
        <BookmarkIcon fill={current.fill} stroke={current.stroke} />
        <span>{active === null ? "Bookmark" : current.label}</span>
        <span className="ml-0.5 text-[10px] opacity-60">▾</span>
      </button>

      {open ? (
        <>
          {/* backdrop — clicking outside closes */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Bookmark colour"
            className="absolute right-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded border border-[#ddd9d0] bg-white shadow-md"
          >
            {CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                role="option"
                aria-selected={active === c.value}
                onClick={() => choose(c.value)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#f4f2ee] ${
                  active === c.value ? "bg-[#f4f2ee]" : ""
                }`}
              >
                <span className="w-4 text-center text-sm">
                  {c.icon ?? <span className="inline-block h-3 w-3 rounded-full border border-[#cfccc2]" />}
                </span>
                <span className="text-[#1e2a2a]">{c.label}</span>
                {active === c.value ? <span className="ml-auto text-[#1f6f6b]">✓</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** SVG bookmark icon — outline when no colour is chosen, filled with the colour otherwise. */
export function BookmarkIcon({ fill, stroke, size = 12 }: { fill: string; stroke: string; size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.17)}
      viewBox="0 0 12 14"
      fill={fill}
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1h10v12l-5-3-5 3V1z" />
    </svg>
  );
}
