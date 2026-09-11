/**
 * FIB_READING — Reading: Fill in the Blanks (drag and drop).
 * docs/01-question-types.md §11. `word_bank` includes distractors, so it must
 * be at least as long as `correct_answers`; every correct answer must actually
 * appear in the bank.
 */

import { z } from "zod";

import { passageWithBlanksSchema } from "./shared";

export const fibReadingSchema = z
  .object({
    passage_with_blanks: passageWithBlanksSchema,
    word_bank: z.array(z.string().min(1)).min(1),
    correct_answers: z.array(z.string().min(1)).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.word_bank.length < data.correct_answers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["word_bank"],
        message: "word_bank must have at least as many entries as correct_answers",
      });
    }
    const bank = new Set(data.word_bank);
    data.correct_answers.forEach((answer, index) => {
      if (!bank.has(answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["correct_answers", index],
          message: "every correct_answers entry must appear in word_bank",
        });
      }
    });
  });

export type FibReadingPayload = z.infer<typeof fibReadingSchema>;
