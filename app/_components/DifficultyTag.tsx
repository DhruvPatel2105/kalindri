import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/practice/questionList";

const STYLES: Record<Difficulty, string> = {
  easy: "bg-[#e3f0ec] text-[#17544f]",
  medium: "bg-[#f5ecd3] text-[#7a5d14]",
  hard: "bg-[#f3dcd5] text-[#8a3622]",
};

/** Easy / Medium / Hard tag; "Unrated" when there is no rating. */
export function DifficultyTag({ difficulty }: { difficulty: Difficulty | null }) {
  return difficulty ? (
    <span className={`rounded px-2 py-0.5 font-medium ${STYLES[difficulty]}`}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  ) : (
    <span className="rounded bg-[#eceae4] px-2 py-0.5 font-medium text-[#5c6a68]">Unrated</span>
  );
}
