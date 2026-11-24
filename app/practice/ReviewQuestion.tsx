import type {
  QuestionReview,
  ReviewBlank,
  ReviewOption,
} from "@/lib/practice/reviewModel";

/**
 * Read-only answer review for one question: green = right, red = wrong, grey
 * = not answered, with the student's answer shown beside the correct one.
 * Rendered only for a submitted test (see testEngine.getReviewQuestion).
 */

const GREEN = "border-[#1f6f6b] bg-[#f4faf9]";
const RED = "border-[#b0472f] bg-[#fdf6f5]";
const PLAIN = "border-[#ddd9d0] bg-white";

export function ReviewQuestion({
  review,
  mode = "test",
}: {
  review: QuestionReview;
  /** Practice words an unattempted question as "answer shown" rather than a scored zero. */
  mode?: "test" | "practice";
}) {
  return (
    <div className="flex flex-col gap-5">
      <Banner review={review} mode={mode} />
      <Body review={review} />
    </div>
  );
}

function Banner({ review, mode }: { review: QuestionReview; mode: "test" | "practice" }) {
  if (review.type === "UNSUPPORTED") {
    return <p className="text-sm text-[#5c6a68]">No review is available for this question type yet.</p>;
  }
  const marks = `${review.score}/${review.maxScore}`;
  const styles = {
    correct: ["Correct", "bg-[#eaf2f1] text-[#17544f]"],
    partial: ["Partly correct", "bg-[#fbf3e3] text-[#8a6a1e]"],
    incorrect: ["Incorrect", "bg-[#fdf2f0] text-[#b0472f]"],
    unanswered: ["Not answered", "bg-[#eceae4] text-[#5c6a68]"],
  } as const;
  const [label, tone] = styles[review.kind];

  const practiceReveal = mode === "practice" && review.kind === "unanswered";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`rounded px-2.5 py-1 text-xs font-semibold ${tone}`}>
          {practiceReveal ? "Answer shown" : label}
        </span>
        {practiceReveal ? null : (
          <span className="text-sm font-semibold text-[#1e2a2a]">{marks} marks</span>
        )}
      </div>
      {review.kind === "unanswered" ? (
        <p className="text-sm text-[#5c6a68]">
          {practiceReveal
            ? "You haven't answered this question yet — the correct answer is shown below. Try Again to have a go."
            : "You didn't answer this question, so it scored 0. The correct answer is shown below."}
        </p>
      ) : null}
    </div>
  );
}

function Body({ review }: { review: QuestionReview }) {
  switch (review.type) {
    case "MCS_READING":
      return (
        <Choice
          passage={review.passage}
          questionText={review.questionText}
          options={review.options}
          answered={review.answered}
        />
      );
    case "MCM_READING":
      return (
        <div className="flex flex-col gap-4">
          <Choice
            passage={review.passage}
            questionText={review.questionText}
            options={review.options}
            answered={review.answered}
          />
          {review.answered ? (
            <p className="text-sm text-[#5c6a68]">
              {review.correctCount} correct {review.correctCount === 1 ? "selection" : "selections"} (+
              {review.correctCount}), {review.incorrectCount} incorrect (−{review.incorrectCount}). Marks
              can&apos;t go below 0.
            </p>
          ) : null}
        </div>
      );
    case "FIB_RW":
    case "FIB_READING":
      return <Blanks parts={review.parts} blanks={review.blanks} answered={review.answered} note={review.note ?? null} />;
    case "REORDER_PARAGRAPH":
      return <Reorder review={review} />;
    default:
      return null;
  }
}

/* ── multiple choice (single and multiple) ─────────────────────────────── */

function Choice({
  passage,
  questionText,
  options,
  answered,
}: {
  passage: string;
  questionText: string;
  options: ReviewOption[];
  answered: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-4 text-sm leading-relaxed text-[#1e2a2a]">
        {passage}
      </div>
      <p className="font-medium text-[#1e2a2a]">{questionText}</p>
      <ul className="flex flex-col gap-2">
        {options.map((option) => {
          // Green: a right answer (picked or missed). Red: picked but wrong.
          const tone = option.correct ? GREEN : option.selected ? RED : PLAIN;
          const tag = option.selected
            ? option.correct
              ? "Your answer · correct"
              : "Your answer"
            : option.correct
              ? answered
                ? "Correct answer (missed)"
                : "Correct answer"
              : null;
          return (
            <li
              key={option.id}
              className={`flex items-center gap-3 rounded border px-3 py-2 text-sm ${tone}`}
            >
              <Mark ok={option.correct ? true : option.selected ? false : null} />
              <span className="text-[#1e2a2a]">{option.text}</span>
              {tag ? (
                <span
                  className={`ml-auto flex-none text-xs font-semibold ${
                    option.correct ? "text-[#17544f]" : "text-[#b0472f]"
                  }`}
                >
                  {tag}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── fill in the blanks (dropdown and drag-and-drop) ───────────────────── */

function Blanks({
  parts,
  blanks,
  answered,
  note,
}: {
  parts: string[];
  blanks: ReviewBlank[];
  answered: boolean;
  note: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] px-7 py-6">
        <p className="text-base leading-loose text-[#283634]">
          {parts.map((text, i) => {
            const blank = blanks[i];
            return (
              <span key={i}>
                {text}
                {blank ? (
                  <span
                    className={`mx-1.5 inline-block min-w-[80px] rounded border px-3 py-0.5 text-center align-middle text-sm ${
                      !answered
                        ? "border-[#ddd9d0] bg-white text-[#7d8a88]"
                        : blank.correct
                          ? "border-[#1f6f6b] bg-[#eaf2f1] font-medium text-[#17544f]"
                          : "border-[#b0472f] bg-[#fdf2f0] text-[#b0472f]"
                    }`}
                  >
                    {blank.submitted || "—"}
                  </span>
                ) : null}
              </span>
            );
          })}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {blanks.map((blank, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded border px-4 py-3 text-sm ${
              !answered ? PLAIN : blank.correct ? GREEN : RED
            }`}
          >
            <Mark ok={answered ? blank.correct : null} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#7d8a88]">
                Blank {i + 1}
              </span>
              {!answered ? (
                <span className="text-[#1e2a2a]">
                  Correct answer: <strong className="text-[#17544f]">{blank.expected}</strong>
                </span>
              ) : blank.correct ? (
                <span className="font-semibold text-[#17544f]">{blank.submitted}</span>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[#b0472f] line-through">
                    {blank.submitted || "(left blank)"}
                  </span>
                  <span className="text-[#9aa39f]">→</span>
                  <span className="font-semibold text-[#17544f]">{blank.expected}</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {note ? (
        <p className="rounded border border-[#e6e2d9] bg-[#fafaf8] px-4 py-3 text-sm leading-relaxed text-[#3d4a48]">
          <span className="font-semibold text-[#1e2a2a]">Note: </span>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/* ── reorder paragraph ─────────────────────────────────────────────────── */

function Reorder({
  review,
}: {
  review: Extract<QuestionReview, { type: "REORDER_PARAGRAPH" }>;
}) {
  const { positions, pairs, answered } = review;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
          <span>Your order</span>
          <span>Correct order</span>
        </div>
        {positions.map((row) => (
          <div key={row.position} className="grid grid-cols-2 gap-3">
            <div
              className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                !answered ? PLAIN : row.correct ? GREEN : RED
              }`}
            >
              <span className="w-4 flex-none font-mono text-xs font-medium text-[#5c6a68]">
                {row.position}
              </span>
              <span className={row.submitted ? "text-[#1e2a2a]" : "text-[#9aa39f]"}>
                {row.submitted || "(nothing placed)"}
              </span>
            </div>
            <div className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${GREEN}`}>
              <span className="w-4 flex-none font-mono text-xs font-medium text-[#1f6f6b]">
                {row.position}
              </span>
              <span className="text-[#1e2a2a]">{row.expected}</span>
            </div>
          </div>
        ))}
        <p className="text-xs text-[#7d8a88]">
          Green or red here compares each position. Marks are given for adjacent pairs, below, so one box out
          of place can cost fewer marks than it looks.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#5c6a68]">
          Adjacent pairs — 1 mark each
        </span>
        {pairs.map((pair, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded border px-4 py-2.5 text-sm ${
              !answered ? PLAIN : pair.correct ? GREEN : RED
            }`}
          >
            <Mark ok={answered ? pair.correct : null} />
            <span className="text-[#1e2a2a]">
              Sentence {i + 1} followed by sentence {i + 2}
            </span>
            <span
              className={`ml-auto text-xs font-semibold ${
                !answered ? "text-[#7d8a88]" : pair.correct ? "text-[#17544f]" : "text-[#b0472f]"
              }`}
            >
              {!answered ? "Not answered" : pair.correct ? "Kept together" : "Not in your order"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** ✓ / ✗ badge; null renders a neutral dot. Colour is never the only signal. */
function Mark({ ok }: { ok: boolean | null }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
        ok === null
          ? "bg-[#eceae4] text-[#9aa39f]"
          : ok
            ? "bg-[#1f6f6b] text-white"
            : "bg-[#b0472f] text-white"
      }`}
    >
      {ok === null ? "·" : ok ? "✓" : "✗"}
    </span>
  );
}
