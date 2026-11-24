import { describe, expect, it } from "vitest";

import { banksFileSchema, mapBank, mapQuestion, markerNumbers, type BankQuestion } from "./parseFibBanks";
import { scoreDeterministic } from "@/lib/scoring/registry";

const stable = () => 0.5;

const q = (over: Partial<BankQuestion> = {}): BankQuestion => ({
  id: "secondary-16",
  number: 16,
  title: "Transit",
  passage: "Riders {{1}} the pass and {{2}} a receipt.",
  blanks: [
    { blank: 2, options: ["keep", "keeps", "kept", "keeping"], answer: "keep" },
    { blank: 1, options: ["renew", "renews", "renewed", "renewing"], answer: "renew" },
  ],
  ...over,
});

describe("markerNumbers", () => {
  it("lists the {{n}} markers in order", () => {
    expect(markerNumbers("a {{1}} b {{2}} c {{3}}")).toEqual([1, 2, 3]);
    expect(markerNumbers("no gaps")).toEqual([]);
  });
});

describe("mapQuestion", () => {
  it("sorts blanks by number, keeps answers and keeps every option", () => {
    const r = mapQuestion(q(), stable);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.payload.blanks.map((b) => b.index)).toEqual([1, 2]);
      expect(r.value.payload.blanks.map((b) => b.correct_option)).toEqual(["renew", "keep"]);
      for (const blank of r.value.payload.blanks) expect(blank.options).toContain(blank.correct_option);
      expect(r.value.payload.blanks[0]?.options).toHaveLength(4);
    }
  });

  it("shuffles options so the answer doesn't stay first", () => {
    let n = 0;
    const r = mapQuestion(q(), () => 1 - (n++ % 7) * 0.13);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.payload.blanks.some((b) => b.options?.[0] !== b.correct_option)).toBe(true);
  });

  it("keeps a note and carries blanks without options as typed blanks", () => {
    const r = mapQuestion(
      q({
        note: "  Blank 2: keep fits.  ",
        blanks: [
          { blank: 1, options: null, answer: "renew" },
          { blank: 2, options: ["keep", "keeps", "kept", "keeping"], answer: "keep" },
        ],
      }),
      stable,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.payload.note).toBe("Blank 2: keep fits.");
      expect(r.value.typedBlanks).toBe(1);
      expect(r.value.payload.blanks[0]?.options).toBeNull();
    }
  });

  it("rejects markers that don't match the blanks, an answer outside its options, wrong option counts", () => {
    expect(mapQuestion(q({ passage: "Only {{1}} here." }), stable).ok).toBe(false);
    expect(mapQuestion(q({ passage: "Riders {{1}} and {{2}} and {{3}}." }), stable).ok).toBe(false);
    const badAnswer = mapQuestion(q({ blanks: [{ blank: 1, options: ["a", "b", "c", "d"], answer: "z" }, { blank: 2, options: ["a", "b", "c", "d"], answer: "a" }] }), stable);
    expect(badAnswer.ok).toBe(false);
    const three = mapQuestion(q({ blanks: [{ blank: 1, options: ["a", "b", "c"], answer: "a" }, { blank: 2, options: ["a", "b", "c", "d"], answer: "a" }] }), stable);
    expect(three.ok).toBe(false);
  });
});

describe("typed (no-options) blanks are marked case-insensitively, like the dropdowns", () => {
  it("scores a typed answer with different capitals as correct", () => {
    const r = mapQuestion(
      q({ passage: "Riders {{1}}.", blanks: [{ blank: 1, options: null, answer: "Renew" }] }),
      stable,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(scoreDeterministic("FIB_RW", r.value.payload, ["renew"]).score).toBe(1);
      expect(scoreDeterministic("FIB_RW", r.value.payload, ["RENEW"]).score).toBe(1);
      expect(scoreDeterministic("FIB_RW", r.value.payload, ["renews"]).score).toBe(0);
      expect(scoreDeterministic("FIB_RW", r.value.payload, [""]).score).toBe(0);
    }
  });
});

describe("mapBank / file schema", () => {
  it("collects problems per question and flags duplicate numbers", () => {
    const { questions, problems } = mapBank("secondaryBank", [q(), q({ id: "secondary-17", number: 16 }), q({ id: "secondary-18", number: 18, passage: "Only {{1}}." })], stable);
    expect(questions).toHaveLength(1);
    expect(problems.map((p) => p.id)).toEqual(["secondary-17", "secondary-18"]);
  });

  it("accepts the file's shape, including extra fields", () => {
    const file = { mainBank: [{ ...q({ id: "main-1", number: 1 }), level: "Easy", optionsSource: "x" }], secondaryBank: [] };
    expect(banksFileSchema.safeParse(file).success).toBe(true);
    expect(banksFileSchema.safeParse({ mainBank: [] }).success).toBe(false);
  });
});
