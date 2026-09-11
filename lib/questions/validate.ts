/**
 * The single entry point every payload must go through. Takes a QuestionType
 * and an unknown value, looks up its schema in the registry, and returns a
 * discriminated result — never throws, never returns partially-parsed data.
 */

import type { z } from "zod";

import { questionSchemas } from "@/lib/questions/schemas";
import type { QuestionType } from "@/lib/questions/types";

export interface FieldError {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: FieldError[] };

type PayloadOf<T extends QuestionType> = z.infer<(typeof questionSchemas)[T]>;

export function validateQuestionPayload<T extends QuestionType>(
  type: T,
  payload: unknown,
): ValidationResult<PayloadOf<T>> {
  const schema = questionSchemas[type];
  const result = schema.safeParse(payload);

  if (result.success) {
    return { success: true, data: result.data as PayloadOf<T> };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
