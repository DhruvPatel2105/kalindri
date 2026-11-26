import { describe, expect, it } from "vitest";

import { mapReorderFile, mapReorderQuestion, normaliseText, reorderFileSchema, titleKey, type ReorderFileQuestion } from "./parseReorderJson";

const q = (over: Partial<ReorderFileQuestion> = {}): ReorderFileQuestion => ({
  id: 1,
  title: "Vaccines",
  difficulty: "Medium",
  paragraphs: { "1": "They protect children.", "2": "For this reason, we require it.", "3": "A healthy school helps.", "4": "Vaccines matter." },
  answer: [3, 4, 1, 2],
  ...over,
});

describe("mapReorderQuestion", () => {
  it("puts the paragraphs in the answer's reading order", () => {
    const r = mapReorderQuestion(q());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.boxes).toEqual(["A healthy school helps.", "Vaccines matter.", "They protect children.", "For this reason, we require it."]);
      expect(r.value.difficulty).toBe("medium");
    }
  });

  it("handles five and six paragraphs and a missing difficulty", () => {
    const six = mapReorderQuestion(q({ difficulty: null, paragraphs: { "1": "a", "2": "b", "3": "c", "4": "d", "5": "e", "6": "f" }, answer: [3, 5, 6, 1, 2, 4] }));
    expect(six.ok).toBe(true);
    if (six.ok) {
      expect(six.value.boxes).toEqual(["c", "e", "f", "a", "b", "d"]);
      expect(six.value.difficulty).toBeNull();
    }
  });

  it("rejects an answer that skips, repeats or invents a paragraph number", () => {
    expect(mapReorderQuestion(q({ answer: [3, 4, 1, 1] })).ok).toBe(false);
    expect(mapReorderQuestion(q({ answer: [3, 4, 1] })).ok).toBe(false);
    expect(mapReorderQuestion(q({ answer: [3, 4, 1, 5] })).ok).toBe(false);
  });
});

describe("mapReorderFile", () => {
  it("collects problems and flags duplicate ids and titles (a (B) variant counts as the same title)", () => {
    const { questions, problems } = mapReorderFile([q(), q({ id: 2, title: "Vaccines (B)" }), q({ id: 1, title: "Other" }), q({ id: 3, title: "Bad", answer: [1, 1, 1, 1] })]);
    expect(questions).toHaveLength(1);
    expect(problems.map((p) => p.id)).toEqual([2, 1, 3]);
  });

  it("accepts the file's shape", () => {
    expect(reorderFileSchema.safeParse([q()]).success).toBe(true);
    expect(reorderFileSchema.safeParse([{ ...q(), difficulty: "Easy-ish" }]).success).toBe(false);
  });
});

describe("matching helpers", () => {
  it("titleKey ignores case and a trailing variant marker", () => {
    expect(titleKey("Bugs (B)")).toBe("bugs");
    expect(titleKey("  E-waste ")).toBe("e-waste");
  });
  it("normaliseText ignores capitals, curly quotes and spacing", () => {
    expect(normaliseText("It’s  “fine”")).toBe(`it's "fine"`);
  });
});
