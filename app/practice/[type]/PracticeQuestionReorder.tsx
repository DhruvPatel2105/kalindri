"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { computeReorderPairBreakdown } from "@/lib/practice/reorderPairBreakdown";
import {
  submitAttempt,
  type SubmitAttemptResult,
} from "@/lib/practice/submitAttempt";

interface Box {
  key: string;
  text: string;
}

/**
 * REORDER_PARAGRAPH — drag-and-drop, reusing design/screens/
 * ReorderParagraphs.dc.html's interaction pattern (two panels: "Source"
 * boxes drag into "Your order", reorderable by dropping on a specific row)
 * rather than inventing a new one. Structurally still mirrors the other
 * PracticeQuestion* components (useTransition, local error state, Next
 * Question button).
 *
 * `boxes` prop arrives PRE-SHUFFLED by the Server Component page (never in
 * the correct/answer order) — see app/practice/[type]/page.tsx. The correct
 * order itself is only ever revealed after submission, via
 * `result.questionSnapshot.boxes` (same answer-key-protection pattern as
 * every other PracticeQuestion* component).
 */
export function PracticeQuestionReorder({
  sessionId,
  boxes,
}: {
  sessionId: string;
  boxes: Box[];
}) {
  const router = useRouter();
  const [source, setSource] = useState<Box[]>(boxes);
  const [target, setTarget] = useState<Box[]>([]);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalCount = boxes.length;
  const allPlaced = target.length === totalCount;

  function moveTo(key: string, destination: "source" | "target", index?: number) {
    const item =
      source.find((box) => box.key === key) ??
      target.find((box) => box.key === key);
    if (!item) return;

    const nextSource = source.filter((box) => box.key !== key);
    const nextTarget = target.filter((box) => box.key !== key);

    if (destination === "source") {
      nextSource.push(item);
    } else {
      const insertAt = index ?? nextTarget.length;
      nextTarget.splice(insertAt, 0, item);
    }

    setSource(nextSource);
    setTarget(nextTarget);
  }

  function handleDragStart(key: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("text/plain", key);
      setDraggingKey(key);
    };
  }

  function handleDragEnd() {
    setDraggingKey(null);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
  }

  function handleDropOnSource(event: React.DragEvent) {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (key) moveTo(key, "source");
  }

  function handleDropOnTargetEnd(event: React.DragEvent) {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (key) moveTo(key, "target", target.length);
  }

  function handleDropOnTargetRow(index: number) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const key = event.dataTransfer.getData("text/plain");
      if (key) moveTo(key, "target", index);
    };
  }

  function handleSubmit() {
    if (!allPlaced) return;
    setError(null);
    startTransition(async () => {
      try {
        const outcome = await submitAttempt(
          sessionId,
          target.map((box) => box.text),
        );
        setResult(outcome);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit.");
      }
    });
  }

  function handleNextQuestion() {
    setSource(boxes);
    setTarget([]);
    setResult(null);
    setError(null);
    router.refresh();
  }

  const correctOrder: string[] =
    result?.questionSnapshot &&
    typeof result.questionSnapshot === "object" &&
    "boxes" in result.questionSnapshot &&
    Array.isArray((result.questionSnapshot as { boxes: unknown }).boxes)
      ? (result.questionSnapshot as { boxes: string[] }).boxes
      : [];

  const pairBreakdown =
    result && correctOrder.length > 0
      ? computeReorderPairBreakdown(
          correctOrder,
          target.map((box) => box.text),
        )
      : [];

  // score/maxScore are common to every DeterministicScoreResult variant, so
  // no need to narrow to AdjacentPairsResult specifically here.
  const reorderResult = result?.scored && result.result ? result.result : null;

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
            onDragOver={handleDragOver}
            onDrop={handleDropOnSource}
            className="flex min-h-[300px] flex-col gap-2 rounded border border-dashed border-[#cfccc2] bg-[#fafaf8] p-3"
          >
            {source.map((box) => (
              <div
                key={box.key}
                draggable={!result}
                onDragStart={handleDragStart(box.key)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm ${
                  draggingKey === box.key
                    ? "border-[#1f6f6b] bg-[#eaf2f1] opacity-60"
                    : "border-[#ddd9d0]"
                } ${result ? "cursor-default" : "cursor-grab"}`}
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
            onDragOver={handleDragOver}
            onDrop={handleDropOnTargetEnd}
            className="flex min-h-[300px] flex-col gap-2 rounded border border-dashed border-[#bfd6d3] bg-[#f2f7f6] p-3"
          >
            {target.map((box, index) => (
              <div
                key={box.key}
                draggable={!result}
                onDragStart={handleDragStart(box.key)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDropOnTargetRow(index)}
                className={`flex items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm ${
                  draggingKey === box.key
                    ? "border-[#1f6f6b] bg-[#eaf2f1] opacity-60"
                    : "border-[#ddd9d0]"
                } ${result ? "cursor-default" : "cursor-grab"}`}
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

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {!result ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            Scored on adjacent pairs, not absolute positions — one box out of
            place costs less than a reversed sequence.
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allPlaced || isPending}
            className="w-fit flex-none rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded border border-[#ddd9d0] bg-white p-4">
          {reorderResult ? (
            <>
              <p
                className={`text-lg font-semibold ${
                  reorderResult.score === reorderResult.maxScore
                    ? "text-[#1f6f6b]"
                    : "text-[#b0472f]"
                }`}
              >
                {reorderResult.score}/{reorderResult.maxScore}
              </p>
              <p className="text-xs text-[#7d8a88]">
                One point per correctly ordered adjacent pair — here&apos;s
                which transitions you got right:
              </p>
              <div className="flex flex-col gap-2">
                {pairBreakdown.map((pairEntry, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                      pairEntry.correct
                        ? "border-[#1f6f6b] bg-[#fafaf8]"
                        : "border-[#b0472f] bg-white"
                    }`}
                  >
                    <span
                      className={
                        pairEntry.correct
                          ? "flex-none text-[#1f6f6b]"
                          : "flex-none text-[#b0472f]"
                      }
                    >
                      {pairEntry.correct ? "✓" : "✗"}
                    </span>
                    <span className="text-[#1e2a2a]">
                      &ldquo;{pairEntry.first}&rdquo; → &ldquo;
                      {pairEntry.second}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#5c6a68]">{result.message}</p>
          )}

          <button
            type="button"
            onClick={handleNextQuestion}
            className="w-fit rounded bg-[#1f6f6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#17544f]"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
