/**
 * Reader for the Fill in the Blanks main-bank answer file (fib-rw-main.json):
 *
 *   [{ id, title, difficulty, text: "... [[1]] ... [[2]] ...", answers: ["whole", "so"] }, ...]
 *
 * `text` marks each blank as [[n]] (stored as {{n}}) and `answers` lists the
 * correct word for blank 1, 2, 3… The file has NO wrong options, so the choices
 * already stored for a question are kept; a sync run only changes the passage,
 * the correct answers and the difficulty. Pure — no database or file access.
 */

import { z } from "zod";

const fileQuestionSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).nullable(),
  text: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1),
});

export const fibMainFileSchema = z.array(fileQuestionSchema);
export type FibMainFileQuestion = z.infer<typeof fileQuestionSchema>;

export interface MappedFibMain {
  fileId: number;
  title: string;
  difficulty: "easy" | "medium" | "hard" | null;
  /** The passage with {{n}} blank markers, as stored. */
  passage: string;
  answers: string[];
}

/** The blank numbers marked in the text, in order of appearance. */
export function fileMarkers(text: string): number[] {
  return [...text.matchAll(/\[\[(\d+)\]\]/g)].map((match) => Number(match[1]));
}

export function mapFibMainQuestion(
  question: FibMainFileQuestion,
): { ok: true; value: MappedFibMain } | { ok: false; errors: string[] } {
  const markers = fileMarkers(question.text);
  const errors: string[] = [];
  if (markers.length !== question.answers.length) {
    errors.push(`The text has ${markers.length} blank marker(s) but ${question.answers.length} answer(s).`);
  } else if (markers.some((marker, i) => marker !== i + 1)) {
    errors.push(`Blank markers must run [[1]], [[2]], … in order (found ${markers.join(", ")}).`);
  }
  if (/\[\[|\]\]/.test(question.text.replace(/\[\[\d+\]\]/g, ""))) errors.push("Stray [[ or ]] in the text.");
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      fileId: question.id,
      title: question.title.trim(),
      difficulty: question.difficulty ? (question.difficulty.toLowerCase() as "easy" | "medium" | "hard") : null,
      passage: question.text.replace(/\[\[(\d+)\]\]/g, "{{$1}}").replace(/\s+/g, " ").trim(),
      answers: question.answers.map((answer) => answer.trim()),
    },
  };
}

export function mapFibMainFile(items: readonly FibMainFileQuestion[]): {
  questions: MappedFibMain[];
  problems: { id: number; title: string; errors: string[] }[];
} {
  const questions: MappedFibMain[] = [];
  const problems: { id: number; title: string; errors: string[] }[] = [];
  const titles = new Set<string>();
  for (const item of items) {
    const extra: string[] = [];
    if (titles.has(item.title.trim().toLowerCase())) extra.push(`Title "${item.title}" is used twice.`);
    titles.add(item.title.trim().toLowerCase());
    const result = mapFibMainQuestion(item);
    if (!result.ok || extra.length > 0) problems.push({ id: item.id, title: item.title, errors: [...extra, ...(result.ok ? [] : result.errors)] });
    else questions.push(result.value);
  }
  return { questions, problems };
}

export interface StoredBlank {
  index: number;
  options: string[] | null;
  correct_option: string;
}

/**
 * The blank as it should be stored for a given correct answer. The file's
 * answer becomes the correct option; if it isn't one of the stored choices it
 * takes the place of one WRONG choice (so there are still four, all different,
 * and the old correct word stays as a wrong choice). Blanks typed in
 * (options: null) just take the new answer.
 */
export function applyAnswer(blank: StoredBlank, answer: string): { blank: StoredBlank; replacedOption: string | null } {
  if (blank.options === null || blank.options.includes(answer)) {
    return { blank: { ...blank, correct_option: answer }, replacedOption: null };
  }
  const victimIndex = blank.options.findIndex((option) => option !== blank.correct_option);
  const victim = blank.options[victimIndex] ?? null;
  const options = blank.options.map((option, i) => (i === victimIndex ? answer : option));
  return { blank: { ...blank, options, correct_option: answer }, replacedOption: victim };
}
