"use client";

import { useState } from "react";

/**
 * FIB_READING answer input — drag words from the bank into gaps. Controlled;
 * `value` is the word in each gap ("" = empty), the same shape the scorer
 * takes. The bank is whatever words aren't placed; correct answers never
 * reach this component.
 */
export function WordBankInput({
  parts,
  wordBank,
  value,
  onChange,
  disabled,
}: {
  parts: string[];
  wordBank: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const blankCount = Math.max(0, parts.length - 1);
  const placed = Array.from({ length: blankCount }, (_, i) => value[i] ?? "");
  const [draggingWord, setDraggingWord] = useState<string | null>(null);

  const used = new Set(placed.filter(Boolean));
  const bank = wordBank.filter((word) => !used.has(word));

  /** Put `word` in a gap (or back in the bank if gapIndex is null), taking it out of any gap it was in. */
  function place(word: string, gapIndex: number | null) {
    if (disabled) return;
    const next = placed.map((existing) => (existing === word ? "" : existing));
    if (gapIndex !== null) next[gapIndex] = word;
    onChange(next);
  }

  function onDragStart(word: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("text/plain", word);
      setDraggingWord(word);
    };
  }
  const allowDrop = (event: React.DragEvent) => event.preventDefault();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        In the text below some words are missing. Drag words from the box
        below to the appropriate place in the text. To undo, drag the word
        back to the box — or click a filled blank to clear it.
      </p>

      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-7 py-6">
        <p className="text-base leading-loose text-[#283634]">
          {parts.map((text, i) => {
            const isGap = i < blankCount;
            const filled = placed[i];
            return (
              <span key={i}>
                {text}
                {isGap ? (
                  <span
                    onDragOver={allowDrop}
                    onDrop={(event) => {
                      event.preventDefault();
                      const word = event.dataTransfer.getData("text/plain");
                      if (word) place(word, i);
                    }}
                    onClick={() => filled && place(filled, null)}
                    className={`mx-1.5 inline-block min-w-[110px] rounded border px-3 py-0.5 text-center align-middle ${
                      filled
                        ? "cursor-pointer border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#173534]"
                        : "border-dashed border-[#a9c4c1] bg-white text-[#7d8a88]"
                    }`}
                  >
                    {filled || "        "}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
          Word bank
        </span>
        <div
          onDragOver={allowDrop}
          onDrop={(event) => {
            event.preventDefault();
            const word = event.dataTransfer.getData("text/plain");
            if (word) place(word, null);
          }}
          className="flex min-h-[64px] flex-wrap gap-2.5 rounded border border-dashed border-[#bfd6d3] bg-[#f2f7f6] p-4"
        >
          {bank.map((word) => (
            <span
              key={word}
              draggable={!disabled}
              onDragStart={onDragStart(word)}
              onDragEnd={() => setDraggingWord(null)}
              className={`cursor-grab rounded border bg-white px-4 py-1.5 text-sm text-[#1e2a2a] shadow-sm ${
                draggingWord === word ? "border-[#1f6f6b] opacity-50" : "border-[#cfccc2]"
              }`}
            >
              {word}
            </span>
          ))}
          {bank.length === 0 ? (
            <span className="text-xs text-[#9aa39f]">All words placed.</span>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-[#7d8a88]">
        There are more words than gaps. One mark per correct placement,
        nothing deducted for wrong ones.
      </p>
    </div>
  );
}
