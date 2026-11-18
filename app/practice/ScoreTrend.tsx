import type { TrendPoint } from "@/lib/practice/typeStats";

const WIDTH = 600;
const HEIGHT = 190;
const PAD = { top: 12, right: 8, bottom: 26, left: 34 };
const MAX_BARS = 20;

/**
 * Accuracy of each completed full test, oldest to newest, as one bar each
 * (correct answers ÷ all questions in that test). One series, so one colour and
 * no legend; the "Practice sessions" list below is the table view of the same
 * data. Shows the latest 20 tests. Server-rendered; each bar carries a
 * <title> for the hover tooltip.
 */
export function ScoreTrend({
  points,
  caption = "Accuracy of each completed full test (retries left out).",
}: {
  points: TrendPoint[];
  caption?: string;
}) {
  const shown = points.slice(-MAX_BARS);
  const firstNumber = points.length - shown.length + 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(shown.length, 1);
  const barW = Math.min(28, slot - 2); // a 2px gap between neighbouring bars
  const y = (percent: number) => PAD.top + plotH * (1 - percent / 100);

  const summary = shown
    .map((p, i) => `Test ${firstNumber + i}: ${p.percent === null ? "no marks" : `${p.percent}%`}`)
    .join("; ");

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Score by test, oldest to newest. ${summary}`}
        className="h-auto w-full"
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e6e2d9"
              strokeWidth={tick === 0 ? 1.5 : 1}
            />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#7d8a88">
              {tick}%
            </text>
          </g>
        ))}

        {shown.map((p, i) => {
          if (p.percent === null) return null;
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const top = y(p.percent);
          const h = Math.max(HEIGHT - PAD.bottom - top, 1);
          return (
            <g key={p.sessionId}>
              <rect x={x} y={top} width={barW} height={h} rx={3} fill="#1f6f6b">
                <title>{`Test ${firstNumber + i} · ${p.percent}%`}</title>
              </rect>
            </g>
          );
        })}

        {shown.length > 0 ? (
          <>
            <text x={PAD.left} y={HEIGHT - 6} fontSize="11" fill="#7d8a88">
              Test {firstNumber}
            </text>
            {shown.length > 1 ? (
              <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize="11" fill="#7d8a88">
                Test {firstNumber + shown.length - 1}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
      <figcaption className="text-xs text-[#7d8a88]">
        {caption}
        {points.length > shown.length ? ` Showing the latest ${shown.length} of ${points.length}.` : ""}
      </figcaption>
    </figure>
  );
}
