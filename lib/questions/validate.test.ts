import { describe, expect, it } from "vitest";

import { fixtures } from "./schemas/fixtures";
import { validateQuestionPayload } from "./validate";

describe("validateQuestionPayload", () => {
  it("returns success: true with parsed data for a valid payload", () => {
    const result = validateQuestionPayload(
      "WRITE_FROM_DICTATION",
      fixtures.WRITE_FROM_DICTATION.valid,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sentence_text).toContain("word1");
    }
  });

  it("returns success: false with field-level errors for a malformed payload", () => {
    const result = validateQuestionPayload(
      "WRITE_FROM_DICTATION",
      fixtures.WRITE_FROM_DICTATION.invalid,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        path: expect.any(String),
        message: expect.any(String),
      });
    }
  });

  it("never throws on a completely unrelated payload shape", () => {
    expect(() => validateQuestionPayload("WRITE_EMAIL", { nope: true })).not.toThrow();
    expect(validateQuestionPayload("WRITE_EMAIL", { nope: true }).success).toBe(
      false,
    );
  });

  it("never throws on a non-object payload", () => {
    expect(() => validateQuestionPayload("WRITE_EMAIL", null)).not.toThrow();
    expect(() => validateQuestionPayload("WRITE_EMAIL", "a string")).not.toThrow();
    expect(validateQuestionPayload("WRITE_EMAIL", null).success).toBe(false);
  });
});
