/**
 * Reader for the Reorder Paragraph answer file (reorder-answers.json):
 *
 *   [{ id, title, difficulty, paragraphs: { "1": "...", "2": "..." }, answer: [2, 1, 3, 4] }, ...]
 *
 * `answer` is the READING ORDER of the numbered paragraphs ("2, 1, 3, 4" means
 * read paragraph 2 first). The stored payload (`boxes`) is the paragraphs
 * already in that correct order. Pure — no database or file access — so the
 * rules are unit-tested. The file is the source of truth: a sync run makes the
 * database match it.
 */

import { z } from "zod";

import { reorderParagraphSchema } from "@/lib/questions/schemas/reorder-paragraph";

const fileQuestionSchema = z.object({
  id: z.number().int(),
  title: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).nullable(),
  paragraphs: z.record(z.string(), z.string().min(1)),
  answer: z.array(z.number().int()),
});

export const reorderFileSchema = z.array(fileQuestionSchema);
export type ReorderFileQuestion = z.infer<typeof fileQuestionSchema>;

export interface MappedReorder {
  fileId: number;
  title: string;
  difficulty: "easy" | "medium" | "hard" | null;
  /** The paragraphs in their correct reading order. */
  boxes: string[];
}

/** Lower-case title without a trailing variant marker like " (B)", so "Bugs (B)" finds "bugs". */
export function titleKey(title: string): string {
  return title.replace(/\s*\([a-z]\)\s*$/i, "").trim().toLowerCase();
}

/** Text compared ignoring capitals, curly quotes and extra spaces. */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function mapReorderQuestion(
  question: ReorderFileQuestion,
): { ok: true; value: MappedReorder } | { ok: false; errors: string[] } {
  const keys = Object.keys(question.paragraphs).map(Number);
  const errors: string[] = [];
  if (keys.some((key) => !Number.isInteger(key))) errors.push("Paragraph numbers must be whole numbers.");
  const expected = [...keys].sort((a, b) => a - b).join(",");
  const given = [...question.answer].sort((a, b) => a - b).join(",");
  if (expected !== given) {
    errors.push(`The answer (${question.answer.join(", ")}) must use every paragraph number once (${expected.replaceAll(",", ", ")}).`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const boxes = question.answer.map((key) => (question.paragraphs[String(key)] ?? "").trim());
  const parsed = reorderParagraphSchema.safeParse({ boxes });
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  return {
    ok: true,
    value: {
      fileId: question.id,
      title: question.title.trim(),
      difficulty: question.difficulty ? (question.difficulty.toLowerCase() as "easy" | "medium" | "hard") : null,
      boxes: parsed.data.boxes,
    },
  };
}

export function mapReorderFile(items: readonly ReorderFileQuestion[]): {
  questions: MappedReorder[];
  problems: { id: number; title: string; errors: string[] }[];
} {
  const questions: MappedReorder[] = [];
  const problems: { id: number; title: string; errors: string[] }[] = [];
  const seenIds = new Set<number>();
  const seenTitles = new Set<string>();
  for (const item of items) {
    const extra: string[] = [];
    if (seenIds.has(item.id)) extra.push(`Id ${item.id} is used twice.`);
    if (seenTitles.has(titleKey(item.title))) extra.push(`Title "${item.title}" is used twice.`);
    seenIds.add(item.id);
    seenTitles.add(titleKey(item.title));
    const result = mapReorderQuestion(item);
    if (!result.ok || extra.length > 0) problems.push({ id: item.id, title: item.title, errors: [...extra, ...(result.ok ? [] : result.errors)] });
    else questions.push(result.value);
  }
  return { questions, problems };
}
