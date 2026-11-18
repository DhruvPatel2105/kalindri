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
      source.find((b) => b.key === key) ?? target.find((b) => b.key === key);
    if (!item) return;
    const nextSource = source.filter((b) => b.key !== key);
    const nextTarget = target.filter((b) => b.key !== key);
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
  function handleDragEnd() { setDraggingKey(null); }
  function handleDragOver(event: React.DragEvent) { event.preventDefault(); }

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
          target.map((b) => b.text),
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
          target.map((b) => b.text),
        )
      : [];

  const reorderResult = result?.scored && result.result ? result.result : null;
  const score = reorderResult?.score ?? 0;
  const maxScore = reorderResult?.maxScore ?? Math.max(0, totalCount - 1);
  const allCorrect = score === maxScore;

  // Build a position-by-position comparison between user order and correct order
  const positionComparison = correctOrder.map((correctText, i) => {
    const submittedText = target[i]?.text ?? "";
    return {
      position: i + 1,
      correct: submittedText === correctText,
      submitted: submittedText,
      expected: correctText,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold leading-relaxed text-[#1e2a2a]">
        The text boxes below have been placed in a random order. Restore the
        original order by dragging boxes from the left panel to the right
        panel.
      </p>

      {/* ── two-panel drag UI (locked after submit) ── */}
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
            {target.map((box, index) => {
              const isCorrectPos =
                result && correctOrder[index] === box.text;
              return (
                <div
                  key={box.key}
                  draggable={!result}
                  onDragStart={handleDragStart(box.key)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={handleDropOnTargetRow(index)}
                  className={`flex items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm ${
                    result
                      ? isCorrectPos
                        ? "border-[#1f6f6b] bg-[#f4faf9]"
                        : "border-[#b0472f] bg-[#fdf6f5]"
                      : draggingKey === box.key
                        ? "border-[#1f6f6b] bg-[#eaf2f1] opacity-60"
                        : "border-[#ddd9d0]"
                  } ${result ? "cursor-default" : "cursor-grab"}`}
                >
                  <span
                    className={`w-4 flex-none font-mono text-xs font-medium ${
                      result
                        ? isCorrectPos
                          ? "text-[#1f6f6b]"
                          : "text-[#b0472f]"
                        : "text-[#1f6f6b]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[#1e2a2a]">{box.text}</span>
                </div>
              );
            })}
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

      {/* ── pre-submit footer ── */}
      {!result ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#7d8a88]">
            Scored on adjacent pairs — one box out of place costs less than a
            reversed sequence.
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allPlaced || isPending}
            className="w-fit flex-none rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f] disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        /* ── results panel ── */
        <div className="flex flex-col gap-4 rounded border border-[#ddd9d0] bg-white p-5">

          {/* score header */}
          {reorderResult ? (
            <>
              <div className="flex items-center gap-3 border-b border-[#f0ede5] pb-4">
                <span
                  className={`text-2xl font-bold ${allCorrect ? "text-[#1f6f6b]" : score === 0 ? "text-[#b0472f]" : "text-[#1e2a2a]"}`}
                >
                  {score}/{maxScore}
                </span>
                <span
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    allCorrect
                      ? "bg-[#eaf2f1] text-[#17544f]"
                      : score === 0
                        ? "bg-[#fdf2f0] text-[#b0472f]"
                        : "bg-[#fbf3e3] text-[#8a6a1e]"
                  }`}
                >
                  {allCorrect
                    ? "Perfect order"
                    : score === 0
                      ? "No correct pairs"
                      : `${maxScore - score} pair${maxScore - score === 1 ? "" : "s"} out of order`}
                </span>
                <span className="text-xs text-[#9aa39f]">
                  1 pt per correct adjacent pair
                </span>
              </div>

              {/* position-by-position comparison */}
              {positionComparison.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
                    Your order vs correct order
                  </span>
                  {positionComparison.map((row) => (
                    <div
                      key={row.position}
                      className={`flex items-start gap-3 rounded border px-4 py-3 text-sm ${
                        row.correct
                          ? "border-[#bcd6d3] bg-[#f4faf9]"
                          : "border-[#e8c4bc] bg-[#fdf6f5]"
                      }`}
                    >
                      {/* position badge */}
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
                          row.correct
                            ? "bg-[#1f6f6b] text-white"
                            : "bg-[#b0472f] text-white"
                        }`}
                      >
                        {row.position}
                      </span>

                      <div className="flex min-w-0 flex-col gap-0.5">
                        {row.correct ? (
                          <span className="font-semibold text-[#17544f]">
                            {row.submitted}
                          </span>
                        ) : (
                          <>
                            {/* user's wrong sentence struck through */}
                            <span className="text-[#b0472f] line-through">
                              {row.submitted || "(empty)"}
                            </span>
                            {/* correct sentence */}
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-xs text-[#9aa39f]">
                                Should be:
                              </span>
                              <span className="font-semibold text-[#17544f]">
                                {row.expected}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* adjacent pair breakdown */}
              {pairBreakdown.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-[#f0ede5] pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
                    Adjacent pair scoring
                  </span>
                  {pairBreakdown.map((pair, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                        pair.correct
                          ? "border-[#bcd6d3] bg-[#f4faf9]"
                          : "border-[#e8c4bc] bg-[#fdf6f5]"
                      }`}
                    >
                      <span
                        className={`flex-none font-bold ${pair.correct ? "text-[#1f6f6b]" : "text-[#b0472f]"}`}
                      >
                        {pair.correct ? "✓" : "✗"}
                      </span>
                      <span className="text-[#5c6a68]">
                        &ldquo;{pair.first}&rdquo;{" "}
                        <span className="text-[#9aa39f]">→</span>{" "}
                        &ldquo;{pair.second}&rdquo;
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[#5c6a68]">{result.message}</p>
          )}

          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={handleNextQuestion}
              className="rounded bg-[#1f6f6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17544f]"
            >
              Next question →
            </button>
            <button
              type="button"
              onClick={() => { setSource(boxes); setTarget([]); setResult(null); setError(null); }}
              className="rounded border border-[#dcd8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e2a2a] hover:border-[#1f6f6b] hover:text-[#1f6f6b]"
            >
              Redo question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
