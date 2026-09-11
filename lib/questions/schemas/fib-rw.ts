/**
 * FIB_RW — Reading & Writing: Fill in the Blanks. docs/01-question-types.md §8.
 * `blanks[].options` is a 4-way multiple choice per blank.
 */

import { z } from "zod";

import { passageWithBlanksSchema } from "./shared";

const blankSchema = z
  .object({
    index: z.number().int().nonnegative(),
    options: z.array(z.string().min(1)).length(4),
    correct_option: z.string().min(1),
  })
  .refine((blank) => blank.options.includes(blank.correct_option), {
    message: "correct_option must be one of options",
    path: ["correct_option"],
  });

export const fibRwSchema = z.object({
  passage_with_blanks: passageWithBlanksSchema,
  blanks: z.array(blankSchema).min(1),
});

export type FibRwPayload = z.infer<typeof fibRwSchema>;
