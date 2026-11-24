/**
 * Reader for the two-bank Fill in the Blanks file (pte_fib_question_banks.json):
 *
 *   { mainBank: [...], secondaryBank: [...] }
 *
 * each question { id, number, title, passage with {{n}} markers, blanks:
 * [{ blank, options (4 choices, or null), answer }], note? ... }.
 *
 * Pure — no database or file access — so every rule is unit-tested. It checks
 * the things that would silently break a question: each {{n}} marker has
 * exactly one blank entry and vice versa, the answer is one of the options,
 * and numbers/ids are unique. Answers are never changed.
 */

import { z } from "zod";

import { fibRwSchema, type FibRwPayload } from "@/lib/questions/schemas/fib-rw";

const blankFileSchema = z.object({
  blank: z.number().int().positive(),
  options: z.array(z.string().min(1)).nullable(),
  answer: z.string().min(1),
});

const questionFileSchema = z
  .object({
    id: z.string().min(1),
    number: z.number().int().positive(),
    title: z.string().min(1),
    passage: z.string().min(1),
    blanks: z.array(blankFileSchema).min(1),
    note: z.string().nullish(),
    level: z.string().nullish(),
    answerConfidence: z.string().nullish(),
    answerKeySource: z.string().nullish(),
    sourceRef: z.string().nullish(),
    optionsSource: z.string().nullish(),
  })
  .passthrough();

export const banksFileSchema = z.object({
  mainBank: z.array(questionFileSchema),
  secondaryBank: z.array(questionFileSchema),
});

export type BanksFile = z.infer<typeof banksFileSchema>;
export type BankQuestion = z.infer<typeof questionFileSchema>;

export interface MappedQuestion {
  id: string;
  number: number;
  title: string;
  payload: FibRwPayload;
  /** Internal provenance (never shown to students). */
  sourceNotes: string;
  /** Blanks with no choices — shown to students as a text box. */
  typedBlanks: number;
}

export interface BankProblems {
  bank: "mainBank" | "secondaryBank";
  id: string;
  errors: string[];
}

/** Display-order shuffle so the stored option order never gives the answer away. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

/** The `{{n}}` marker numbers in a passage, in order of appearance. */
export function markerNumbers(passage: string): number[] {
  return [...passage.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
}

/**
 * Converts one file question to the stored payload, or lists what is wrong
 * with it. The blank list is sorted by blank number; options (when present)
 * are shuffled, the answer is kept exactly as given.
 */
export function mapQuestion(
  question: BankQuestion,
  random: () => number = Math.random,
): { ok: true; value: MappedQuestion } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const markers = markerNumbers(question.passage);
  const blankNumbers = question.blanks.map((blank) => blank.blank);

  if (new Set(markers).size !== markers.length) errors.push("A {{n}} marker appears more than once in the passage.");
  if (new Set(blankNumbers).size !== blankNumbers.length) errors.push("Two blanks share the same number.");
  const sortedMarkers = [...new Set(markers)].sort((a, b) => a - b);
  const sortedBlanks = [...new Set(blankNumbers)].sort((a, b) => a - b);
  if (sortedMarkers.join() !== sortedBlanks.join()) {
    errors.push(
      `Passage markers {{${sortedMarkers.join("}}, {{")}}} don't match the blanks (${sortedBlanks.join(", ")}).`,
    );
  }
  for (const blank of question.blanks) {
    if (blank.options !== null) {
      if (blank.options.length !== 4) errors.push(`Blank ${blank.blank} has ${blank.options.length} options, expected 4.`);
      if (new Set(blank.options).size !== blank.options.length) errors.push(`Blank ${blank.blank} repeats an option.`);
      if (!blank.options.includes(blank.answer)) errors.push(`Blank ${blank.blank}: answer "${blank.answer}" is not one of its options.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const note = question.note?.trim();
  const payload = {
    passage_with_blanks: question.passage,
    blanks: [...question.blanks]
      .sort((a, b) => a.blank - b.blank)
      .map((blank) => ({
        index: blank.blank,
        options: blank.options === null ? null : shuffle(blank.options, random),
        correct_option: blank.answer,
      })),
    ...(note ? { note } : {}),
  };
  const parsed = fibRwSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };

  const provenance = [
    question.sourceRef ? `ref ${question.sourceRef}` : null,
    question.answerKeySource ? `key: ${question.answerKeySource}` : null,
    question.answerConfidence ? `confidence: ${question.answerConfidence}` : null,
    question.level ? `level: ${question.level}` : null,
  ].filter(Boolean);
  return {
    ok: true,
    value: {
      id: question.id,
      number: question.number,
      title: question.title,
      payload: parsed.data,
      sourceNotes: [`Title: ${question.title}`, ...provenance].join(" | "),
      typedBlanks: payload.blanks.filter((blank) => blank.options === null).length,
    },
  };
}

/** Maps a whole bank in numbered order, collecting every problem; also flags duplicate numbers and ids. */
export function mapBank(
  bank: "mainBank" | "secondaryBank",
  questions: readonly BankQuestion[],
  random: () => number = Math.random,
): { questions: MappedQuestion[]; problems: BankProblems[] } {
  const problems: BankProblems[] = [];
  const mapped: MappedQuestion[] = [];
  const numbers = new Set<number>();
  const ids = new Set<string>();
  for (const question of [...questions].sort((a, b) => a.number - b.number)) {
    const extra: string[] = [];
    if (numbers.has(question.number)) extra.push(`Number ${question.number} is used twice.`);
    if (ids.has(question.id)) extra.push(`Id ${question.id} is used twice.`);
    numbers.add(question.number);
    ids.add(question.id);
    const result = mapQuestion(question, random);
    if (!result.ok || extra.length > 0) {
      problems.push({ bank, id: question.id, errors: [...extra, ...(result.ok ? [] : result.errors)] });
    } else {
      mapped.push(result.value);
    }
  }
  return { questions: mapped, problems };
}
