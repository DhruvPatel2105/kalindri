import { describe, expect, it } from "vitest";

import { NAV_SECTIONS } from "./navigation";
import { QUESTION_TYPES } from "./types";

const items = NAV_SECTIONS.flatMap((section) => section.items);

describe("navigation menu sections", () => {
  it("lists every one of the 19 question types exactly once — no repeats, none missing", () => {
    const types = items.flatMap((item) => (item.type ? [item.type] : []));
    expect(types).toHaveLength(QUESTION_TYPES.length);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual([...QUESTION_TYPES].sort());
  });

  it("Personal Introduction is the only item that is not a question type", () => {
    expect(items.filter((item) => !item.type).map((item) => item.label)).toEqual([
      "Personal Introduction (unscored)",
    ]);
  });

  it("has the four sections in test order with the expected sizes", () => {
    expect(NAV_SECTIONS.map((s) => [s.title, s.items.length])).toEqual([
      ["Speaking", 6],
      ["Writing", 2],
      ["Reading", 5],
      ["Listening", 7],
    ]);
  });

  it("puts each type in the section it is sat in", () => {
    const section = (title: string) => NAV_SECTIONS.find((s) => s.title === title)?.items.map((i) => i.type);
    expect(section("Writing")).toEqual(["SUMMARIZE_WRITTEN_TEXT", "WRITE_EMAIL"]);
    expect(section("Reading")).toEqual(["FIB_RW", "MCM_READING", "REORDER_PARAGRAPH", "FIB_READING", "MCS_READING"]);
    expect(section("Speaking")).toContain("READ_ALOUD");
    expect(section("Listening")).toContain("WRITE_FROM_DICTATION");
  });
});
