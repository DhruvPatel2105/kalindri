"use client";

import { useState } from "react";

import { splitReorderBoxes, type ReorderBox } from "@/lib/practice/reorderBoxes";

/**
 * REORDER_PARAGRAPH answer input — drag boxes from the left panel into the
 * right panel in the order you think they go. Controlled: `value` is the
 * placed box texts in order, the same shape the scorer takes. The boxes
 * arrive already shuffled by the server; the true order never reaches here.
 *
 * Unlike the old single-question screen, a partial ordering is a valid answer
 * (the student may leave the test unfinished); the scorer marks the pairs
 * that are right.
 */
export function ReorderInput({
  boxes,
  value,
  onChange,
  disabled,
}: {
  boxes: ReorderBox[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const { source, target } = splitReorderBoxes(boxes, value);

  function moveTo(key: string, destination: "source" | "target", index?: number) {
    if (disabled) return;
    const item = [...source, ...target].find((b) => b.key === key);
    if (!item) return;
    const nextTarget = target.filter((b) => b.key !== key);
    if (destination === "target") {
      nextTarget.splice(index ?? nextTarget.length, 0, item);
    }
    onChange(nextTarget.map((b) => b.text));
  }

  const allowDrop = (event: React.DragEvent) => event.preventDefault();
  const onDragStart = (key: string) => (event: React.DragEvent) => {
    event.dataTransfer.setData("text/plain", key);
    setDraggingKey(key);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        The text boxes below have been placed in a random order. Restore the
        original order by dragging boxes from the left panel to the right
        panel.
      </p>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
            Source
          </span>
          <div
            onDragOver={allowDrop}
            onDrop={(event) => {
              event.preventDefault();
              const key = event.dataTransfer.getData("text/plain");
              if (key) moveTo(key, "source");
            }}
            className="flex min-h-[300px] flex-col gap-2 rounded border border-dashed border-[#cfccc2] bg-[#fafaf8] p-3"
          >
            {source.map((box) => (
              <div
                key={box.key}
                draggable={!disabled}
                onDragStart={onDragStart(box.key)}
                onDragEnd={() => setDraggingKey(null)}
                className={`flex cursor-grab items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm ${
                  draggingKey === box.key
                    ? "border-[#1f6f6b] bg-[#eaf2f1] opacity-60"
                    : "border-[#ddd9d0]"
                }`}
              >
                <span className="font-mono text-xs text-[#8a938f]">≡</span>
                <span className="text-[#1e2a2a]">{box.text}</span>
              </div>
            ))}
            {source.length === 0 ? (
              <span className="text-xs text-[#9aa39f]">All boxes placed.</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
            Your order
          </span>
          <div
            onDragOver={allowDrop}
            onDrop={(event) => {
              event.preventDefault();
              const key = event.dataTransfer.getData("text/plain");
              if (key) moveTo(key, "target", target.length);
            }}
            className="flex min-h-[300px] flex-col gap-2 rounded border border-dashed border-[#bfd6d3] bg-[#f2f7f6] p-3"
          >
            {target.map((box, index) => (
              <div
                key={box.key}
                draggable={!disabled}
                onDragStart={onDragStart(box.key)}
                onDragEnd={() => setDraggingKey(null)}
                onDragOver={allowDrop}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const key = event.dataTransfer.getData("text/plain");
                  if (key) moveTo(key, "target", index);
                }}
                className={`flex cursor-grab items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm ${
                  draggingKey === box.key
                    ? "border-[#1f6f6b] bg-[#eaf2f1] opacity-60"
                    : "border-[#ddd9d0]"
                }`}
              >
                <span className="w-4 flex-none font-mono text-xs font-medium text-[#1f6f6b]">
                  {index + 1}
                </span>
                <span className="text-[#1e2a2a]">{box.text}</span>
              </div>
            ))}
            {target.length === 0 ? (
              <span className="text-xs text-[#9aa39f]">
                Drag boxes here in the correct order.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-xs text-[#7d8a88]">
        Scored on adjacent pairs — one box out of place costs less than a
        reversed sequence.
      </p>
    </div>
  );
}
