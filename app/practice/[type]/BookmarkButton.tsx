"use client";

import { useState } from "react";

const COLOURS = [
  { label: "None",   bg: "bg-white",        border: "border-[#dcd8cf]", icon: null,       text: "text-[#9aa39f]" },
  { label: "Red",    bg: "bg-[#fdf2f0]",    border: "border-[#e8c4bc]", icon: "🔴",       text: "text-[#b0472f]" },
  { label: "Orange", bg: "bg-[#fdf6ed]",    border: "border-[#e8d4a8]", icon: "🟠",       text: "text-[#c47b1e]" },
  { label: "Yellow", bg: "bg-[#fdfbed]",    border: "border-[#e6e08a]", icon: "🟡",       text: "text-[#a09b1e]" },
  { label: "Green",  bg: "bg-[#f4faf9]",    border: "border-[#bcd6d3]", icon: "🟢",       text: "text-[#1f6f6b]" },
] as const;

type ColourIndex = 0 | 1 | 2 | 3 | 4;

export function BookmarkButton() {
  const [active, setActive] = useState<ColourIndex>(0);
  const [open, setOpen] = useState(false);

  const current = COLOURS[active];

  return (
    <div className="relative">
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Bookmark this question"
        className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${current.bg} ${current.border} ${current.text}`}
      >
        <BookmarkIcon filled={active !== 0} colour={active} />
        <span>{active === 0 ? "Bookmark" : current.label}</span>
        <span className="ml-0.5 text-[10px] opacity-60">▾</span>
      </button>

      {/* dropdown */}
      {open ? (
        <>
          {/* backdrop — clicking outside closes */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded border border-[#ddd9d0] bg-white shadow-md">
            {COLOURS.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  setActive(i as ColourIndex);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#f4f2ee] ${
                  active === i ? "bg-[#f4f2ee]" : ""
                }`}
              >
                <span className="w-4 text-center text-sm">
                  {c.icon ?? <span className="inline-block h-3 w-3 rounded-full border border-[#cfccc2]" />}
                </span>
                <span className="text-[#1e2a2a]">{c.label}</span>
                {active === i ? (
                  <span className="ml-auto text-[#1f6f6b]">✓</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// SVG bookmark icon — outline when unset, filled when any colour chosen
function BookmarkIcon({
  filled,
  colour,
}: {
  filled: boolean;
  colour: ColourIndex;
}) {
  const fills: Record<ColourIndex, string> = {
    0: "none",
    1: "#b0472f",
    2: "#c47b1e",
    3: "#a09b1e",
    4: "#1f6f6b",
  };
  const strokes: Record<ColourIndex, string> = {
    0: "#9aa39f",
    1: "#b0472f",
    2: "#c47b1e",
    3: "#a09b1e",
    4: "#1f6f6b",
  };

  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill={filled ? fills[colour] : "none"}
      stroke={strokes[colour]}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1h10v12l-5-3-5 3V1z" />
    </svg>
  );
}
