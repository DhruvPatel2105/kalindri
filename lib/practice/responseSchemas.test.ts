import { describe, expect, it } from "vitest";

import { DETERMINISTIC_QUESTION_TYPES } from "@/lib/scoring/registry";

import {
  responseSchemas,
  validateDeterministicResponse,
} from "./responseSchemas";

describe("responseSchemas", () => {
  it("has exactly one schema per deterministic type — no gaps, no extras", () => {
    expect(Object.keys(responseSchemas).sort()).toEqual(
      [...DETERMINISTIC_QUESTION_TYPES].sort(),
    );
  });
});

describe("validateDeterministicResponse — array-of-strings types", () => {
  const arrayOfStringsTypes = [
    "FIB_RW",
    "MCM_READING",
    "REORDER_PARAGRAPH",
    "FIB_READING",
    "MCM_LISTENING",
    "FIB_LISTENING",
  ] as const;

  it.each(arrayOfStringsTypes)("%s accepts an array of strings", (type) => {
    expect(validateDeterministicResponse(type, ["a", "b"]).success).toBe(
      true,
    );
  });

  it.each(arrayOfStringsTypes)(
    "%s accepts an empty array — an incomplete answer is still valid",
    (type) => {
      expect(validateDeterministicResponse(type, []).success).toBe(true);
    },
  );

  it.each(arrayOfStringsTypes)(
    "%s rejects a single string instead of an array",
    (type) => {
      expect(validateDeterministicResponse(type, "not-an-array").success).toBe(
        false,
      );
    },
  );

  it.each(arrayOfStringsTypes)(
    "%s rejects an array containing a non-string element",
    (type) => {
      expect(validateDeterministicResponse(type, ["a", 2]).success).toBe(
        false,
      );
    },
  );
});

describe("validateDeterministicResponse — single-string types", () => {
  const stringTypes = [
    "MCS_READING",
    "MCS_LISTENING",
    "SELECT_MISSING_WORD",
    "WRITE_FROM_DICTATION",
  ] as const;

  it.each(stringTypes)("%s accepts a string", (type) => {
    expect(validateDeterministicResponse(type, "option-a").success).toBe(
      true,
    );
  });

  it.each(stringTypes)(
    "%s accepts an empty string — an incomplete answer is still valid",
    (type) => {
      expect(validateDeterministicResponse(type, "").success).toBe(true);
    },
  );

  it.each(stringTypes)("%s rejects an array instead of a string", (type) => {
    expect(validateDeterministicResponse(type, ["a"]).success).toBe(false);
  });

  it.each(stringTypes)("%s rejects a number instead of a string", (type) => {
    expect(validateDeterministicResponse(type, 42).success).toBe(false);
  });
});

describe("validateDeterministicResponse — HIGHLIGHT_INCORRECT_WORDS (array of non-negative integers)", () => {
  it("accepts an array of non-negative integers", () => {
    expect(
      validateDeterministicResponse("HIGHLIGHT_INCORRECT_WORDS", [0, 3, 7])
        .success,
    ).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(
      validateDeterministicResponse("HIGHLIGHT_INCORRECT_WORDS", []).success,
    ).toBe(true);
  });

  it("rejects a negative number", () => {
    expect(
      validateDeterministicResponse("HIGHLIGHT_INCORRECT_WORDS", [-1])
        .success,
    ).toBe(false);
  });

  it("rejects a non-integer number", () => {
    expect(
      validateDeterministicResponse("HIGHLIGHT_INCORRECT_WORDS", [1.5])
        .success,
    ).toBe(false);
  });

  it("rejects an array of strings", () => {
    expect(
      validateDeterministicResponse("HIGHLIGHT_INCORRECT_WORDS", ["1", "2"])
        .success,
    ).toBe(false);
  });
});

describe("validateDeterministicResponse — universal malformed input", () => {
  it("rejects null for every deterministic type, without throwing", () => {
    for (const type of DETERMINISTIC_QUESTION_TYPES) {
      expect(() => validateDeterministicResponse(type, null)).not.toThrow();
      expect(validateDeterministicResponse(type, null).success).toBe(false);
    }
  });

  it("rejects undefined for every deterministic type, without throwing", () => {
    for (const type of DETERMINISTIC_QUESTION_TYPES) {
      expect(() =>
        validateDeterministicResponse(type, undefined),
      ).not.toThrow();
      expect(validateDeterministicResponse(type, undefined).success).toBe(
        false,
      );
    }
  });

  it("returns a non-empty, readable error message on failure", () => {
    const result = validateDeterministicResponse("MCS_READING", 42);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
