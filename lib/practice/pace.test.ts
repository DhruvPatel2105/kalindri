import { describe, expect, it } from "vitest";

import { analyzeTiming, formatSeconds, suggestedPace } from "./pace";

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

describe("analyzeTiming", () => {
  const q = (index: number, seconds: number | null, kind: "correct" | "partial" | "incorrect" | "unanswered" | null) => ({ index, seconds, kind });

  it("is null when nothing was timed", () => {
    expect(analyzeTiming("MCS_READING", [q(0, null, "correct"), q(1, 0, "incorrect")])).toBeNull();
  });

  it("totals, averages and counts questions against the pace", () => {
    const a = analyzeTiming("MCS_READING", [q(0, 60, "correct"), q(1, 100, "correct"), q(2, 140, "incorrect")]);
    expect(a?.totalSeconds).toBe(300);
    expect(a?.averageSeconds).toBe(100);
    expect(a?.withinPace).toBe(1);
    expect(a?.overPace).toBe(2);
    expect(a?.slowest).toEqual({ index: 2, seconds: 140 });
    expect(a?.insights[0]).toMatch(/averaged 1m 40s.*1–1\.5 min.*2 of 3 questions were over/);
    expect(a?.insights.join(" ")).toMatch(/Question 3 took longest at 2m 20s — 50s over/);
  });

  it("compares time on right and missed answers only when both exist", () => {
    const both = analyzeTiming("MCS_READING", [q(0, 40, "correct"), q(1, 100, "incorrect")]);
    expect(both?.averageCorrectSeconds).toBe(40);
    expect(both?.averageMissedSeconds).toBe(100);
    expect(both?.insights.join(" ")).toMatch(/more time on the questions you missed/);
    const onlyCorrect = analyzeTiming("MCS_READING", [q(0, 40, "correct"), q(1, 50, "correct")]);
    expect(onlyCorrect?.averageCorrectSeconds).toBeNull();
    expect(onlyCorrect?.insights.join(" ")).toMatch(/Every question was within the suggested pace/);
  });

  it("flags wrong answers given in under a quarter of the pace as possibly rushed", () => {
    const a = analyzeTiming("MCS_READING", [q(0, 10, "incorrect"), q(1, 80, "incorrect"), q(2, 12, "correct")]);
    expect(a?.rushedMisses).toEqual([0]);
    expect(a?.insights.join(" ")).toMatch(/Question 1 was answered incorrectly in under 23s/);
  });

  it("still reports the average for types with no suggested pace", () => {
    const a = analyzeTiming("READ_ALOUD", [q(0, 30, "correct")]);
    expect(a?.pace).toBeNull();
    expect((a?.withinPace ?? 0) + (a?.overPace ?? 0)).toBe(0);
    expect(a?.insights[0]).toBe("You averaged 30s per question.");
  });
});
