import { describe, expect, it } from "vitest";

import type { ClientQuestion } from "./clientQuestion";
import { questionHeader } from "./questionHeader";

describe("questionHeader", () => {
  it("multiple choice uses the question text", () => {
    const q: ClientQuestion = { kind: "MCS_READING", id: "1", passage: "p", questionText: "What is the main idea?", options: [] };
    expect(questionHeader(q)).toBe("What is the main idea?");
  });

  it("clips long text with an ellipsis and tidies whitespace", () => {
    const q: ClientQuestion = { kind: "MCM_READING", id: "1", passage: "p", questionText: `  ${"word ".repeat(60)}  `, options: [] };
    const header = questionHeader(q);
    expect(header.length).toBeLessThanOrEqual(90);
    expect(header.endsWith("…")).toBe(true);
    expect(header).not.toMatch(/\s{2}/);
  });

  it("fill in the blanks shows only the text BEFORE the first blank", () => {
    const q: ClientQuestion = { kind: "FIB_RW", id: "1", parts: ["The committee met on Monday and ", " the plan."], blanks: [{ options: ["approved", "x", "y", "z"] }] };
    const header = questionHeader(q);
    expect(header).toBe("Fill in the blanks: The committee met on Monday and…");
    expect(header).not.toContain("approved");
  });

  it("word-bank fill in the blanks is labelled and never lists the bank", () => {
    const q: ClientQuestion = { kind: "FIB_READING", id: "1", parts: ["Winters are ", " here."], wordBank: ["cold", "warm"] };
    expect(questionHeader(q)).toBe("Fill in the blanks (word bank): Winters are…");
    expect(questionHeader(q)).not.toContain("cold");
  });

  it("a blank-first passage falls back to the plain label", () => {
    const q: ClientQuestion = { kind: "FIB_RW", id: "1", parts: ["", " is here."], blanks: [{ options: ["a", "b", "c", "d"] }] };
    expect(questionHeader(q)).toBe("Fill in the blanks");
  });

  it("reorder gives the count only — nothing about the order", () => {
    const q: ClientQuestion = { kind: "REORDER_PARAGRAPH", id: "1", boxes: [{ key: "box-0", text: "Second." }, { key: "box-1", text: "First." }, { key: "box-2", text: "Third." }] };
    expect(questionHeader(q)).toBe("Reorder 3 sentences");
  });

  it("unsupported types get a neutral label", () => {
    expect(questionHeader({ kind: "UNSUPPORTED", id: "1", type: "WRITE_EMAIL" })).toBe("Question");
  });
});
