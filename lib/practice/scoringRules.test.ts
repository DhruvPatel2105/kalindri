import { describe, expect, it } from "vitest";

import { DETERMINISTIC_QUESTION_TYPES } from "@/lib/scoring/registry";

import { SCORER_VERSION, scoringRulesFor } from "./scoringRules";

describe("scoringRulesFor", () => {
  it("describes every deterministic type, so none is saved without its rules", () => {
    for (const type of DETERMINISTIC_QUESTION_TYPES) {
      const rules = scoringRulesFor(type);
      expect(rules, type).not.toBeNull();
      expect(rules?.rule.length).toBeGreaterThan(10);
      expect(rules?.scorerVersion).toBe(SCORER_VERSION);
    }
  });

  it("matches the documented rules for the Reading types", () => {
    expect(scoringRulesFor("MCM_READING")?.rule).toMatch(/−1.*never below 0/);
    expect(scoringRulesFor("REORDER_PARAGRAPH")?.rule).toMatch(/adjacent pair.*N−1/);
    expect(scoringRulesFor("FIB_RW")?.scorer).toBe("wordBySpelling");
    expect(scoringRulesFor("FIB_READING")?.scorer).toBe("wordBySpelling");
    expect(scoringRulesFor("MCS_READING")?.scorer).toBe("exactMatch");
  });

  it("returns null for types scored by AI or speech", () => {
    expect(scoringRulesFor("WRITE_EMAIL")).toBeNull();
    expect(scoringRulesFor("READ_ALOUD")).toBeNull();
  });
});
