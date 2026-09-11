import { describe, expect, expectTypeOf, it } from "vitest";

import { QUESTION_TYPES, type QuestionType } from "@/lib/questions/types";

import { questionSchemas } from "./index";

/**
 * Pins the registry to the full QuestionType set, at both runtime and the
 * type level. A type added to the Drizzle enum without a matching schema here
 * fails all three checks below — the `satisfies` in index.ts fails typecheck,
 * `expectTypeOf` fails typecheck, and the key-set assertion fails at runtime
 * even if someone routes around the type system (e.g. an `as` cast).
 */
describe("question schema registry", () => {
  it("has exactly 19 entries", () => {
    expect(Object.keys(questionSchemas)).toHaveLength(19);
  });

  it("has exactly one schema per QuestionType — no gaps, no extras", () => {
    expect(Object.keys(questionSchemas).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
  });

  it("is keyed by every QuestionType at the type level", () => {
    expectTypeOf<keyof typeof questionSchemas>().toEqualTypeOf<QuestionType>();
  });
});
