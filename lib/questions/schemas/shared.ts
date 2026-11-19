/**
 * Pieces shared by more than one payload schema. Enum values come from
 * lib/questions/enums.ts — the same constants the Drizzle schema builds its
 * Postgres enums from — so they can't drift, and no database code is pulled
 * in (these schemas also run in the browser). The rest are field shapes that
 * repeat verbatim across docs/01-question-types.md.
 */

import { z } from "zod";

import { QUESTION_ACCENTS, QUESTION_DIFFICULTIES } from "@/lib/questions/enums";

export const difficultySchema = z.enum(QUESTION_DIFFICULTIES);
export const accentSchema = z.enum(QUESTION_ACCENTS);
export const registerSchema = z.enum(["formal", "informal"]);

/** An MCQ option: `options[]` across every multiple-choice type. */
export const mcqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});
export type McqOption = z.infer<typeof mcqOptionSchema>;

function optionIds(options: McqOption[]): Set<string> {
  return new Set(options.map((o) => o.id));
}

/** `correct_option_id` must name one of the given `options`. */
export function refineSingleCorrectOption<
  T extends { options: McqOption[]; correct_option_id: string },
>(data: T, ctx: z.RefinementCtx): void {
  if (!optionIds(data.options).has(data.correct_option_id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correct_option_id"],
      message: "correct_option_id must be the id of one of the options",
    });
  }
}

/** `correct_option_ids` must all name one of the given `options`. */
export function refineMultipleCorrectOptions<
  T extends { options: McqOption[]; correct_option_ids: string[] },
>(data: T, ctx: z.RefinementCtx): void {
  const ids = optionIds(data.options);
  data.correct_option_ids.forEach((id, index) => {
    if (!ids.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correct_option_ids", index],
        message: "correct_option_ids must each be the id of one of the options",
      });
    }
  });
}

export function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

/** `passage_with_blanks` must contain at least one `{{n}}` marker. */
export const passageWithBlanksSchema = z
  .string()
  .min(1)
  .refine((value) => /\{\{\d+\}\}/.test(value), {
    message: "must contain at least one {{n}} blank marker",
  });
