import { describe, expect, it } from "vitest";

import { formatSeconds, suggestedPace } from "./pace";

describe("suggestedPace", () => {
  it("has the reading and listening paces and none for speaking", () => {
    expect(suggestedPace("FIB_RW")?.limit).toBe(120);
    expect(suggestedPace("MCM_READING")?.limit).toBe(90);
    expect(suggestedPace("REORDER_PARAGRAPH")?.limit).toBe(120);
    expect(suggestedPace("WRITE_EMAIL")?.limit).toBe(540);
    expect(suggestedPace("READ_ALOUD")).toBeNull();
  });
});

describe("formatSeconds", () => {
  it("reads naturally", () => {
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(80)).toBe("1m 20s");
    expect(formatSeconds(120)).toBe("2m");
    expect(formatSeconds(-3)).toBe("0s");
  });
});
