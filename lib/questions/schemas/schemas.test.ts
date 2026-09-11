import { describe, expect, it } from "vitest";

import { QUESTION_TYPES } from "@/lib/questions/types";

import { fixtures } from "./fixtures";
import { questionSchemas } from "./index";

describe("each schema", () => {
  for (const type of QUESTION_TYPES) {
    const { valid, invalid } = fixtures[type];
    const schema = questionSchemas[type];

    it(`${type} accepts a valid example`, () => {
      const result = schema.safeParse(valid);
      expect(result.success, JSON.stringify(!result.success && result.error.issues)).toBe(true);
    });

    it(`${type} rejects a malformed example`, () => {
      expect(schema.safeParse(invalid).success).toBe(false);
    });
  }
});

/**
 * The LLM-scored content types that carry `key_points` per the doc. Write
 * Email's equivalent field is `bullet_points` (exactly 3), documented under a
 * different name — covered separately below.
 */
const KEY_POINTS_TYPES = [
  "DESCRIBE_IMAGE",
  "RESPOND_TO_SITUATION",
  "SUMMARIZE_WRITTEN_TEXT",
  "SUMMARIZE_SPOKEN_TEXT",
] as const;

function withoutField(
  payload: unknown,
  field: string,
): Record<string, unknown> {
  const clone = { ...(payload as Record<string, unknown>) };
  delete clone[field];
  return clone;
}

describe("content-scored types require key_points", () => {
  for (const type of KEY_POINTS_TYPES) {
    it(`${type} rejects a payload missing key_points`, () => {
      const payload = withoutField(fixtures[type].valid, "key_points");
      expect(questionSchemas[type].safeParse(payload).success).toBe(false);
    });
  }

  it("WRITE_EMAIL rejects a payload missing bullet_points (its key_points equivalent)", () => {
    const payload = withoutField(fixtures.WRITE_EMAIL.valid, "bullet_points");
    expect(questionSchemas.WRITE_EMAIL.safeParse(payload).success).toBe(false);
  });
});
