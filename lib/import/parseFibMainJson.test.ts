import { describe, expect, it } from "vitest";

import { applyAnswer, fibMainFileSchema, mapFibMainFile, mapFibMainQuestion, type FibMainFileQuestion } from "./parseFibMainJson";

const q = (over: Partial<FibMainFileQuestion> = {}): FibMainFileQuestion => ({
  id: 1,
  title: "Exercise",
  difficulty: "Easy",
  text: "People get little exercise in their [[1]] routines and carry too [[2]] fat.",
  answers: ["daily", "much"],
  ...over,
});

describe("mapFibMainQuestion", () => {
  it("turns [[n]] into {{n}} and keeps the answers", () => {
    const r = mapFibMainQuestion(q());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.passage).toBe("People get little exercise in their {{1}} routines and carry too {{2}} fat.");
      expect(r.value.answers).toEqual(["daily", "much"]);
      expect(r.value.difficulty).toBe("easy");
    }
  });

  it("rejects a marker/answer count mismatch, out-of-order markers and stray brackets", () => {
    expect(mapFibMainQuestion(q({ answers: ["daily"] })).ok).toBe(false);
    expect(mapFibMainQuestion(q({ text: "a [[2]] b [[1]]." })).ok).toBe(false);
    expect(mapFibMainQuestion(q({ text: "a [[1]] b [[ [[2]]." })).ok).toBe(false);
  });
});

describe("mapFibMainFile / schema", () => {
  it("flags a repeated title and accepts the file's shape", () => {
    const { questions, problems } = mapFibMainFile([q(), q({ id: 2 })]);
    expect(questions).toHaveLength(1);
    expect(problems.map((p) => p.id)).toEqual([2]);
    expect(fibMainFileSchema.safeParse([q()]).success).toBe(true);
    expect(fibMainFileSchema.safeParse([{ ...q(), difficulty: "Tough" }]).success).toBe(false);
  });
});

describe("applyAnswer", () => {
  const blank = { index: 1, options: ["daily", "daily's", "dailies", "day"], correct_option: "daily" };

  it("keeps the options when the answer is already one of them", () => {
    const r = applyAnswer(blank, "dailies");
    expect(r.replacedOption).toBeNull();
    expect(r.blank.options).toEqual(blank.options);
    expect(r.blank.correct_option).toBe("dailies");
  });

  it("swaps a wrong option for an answer that isn't offered, keeping four different choices", () => {
    const r = applyAnswer(blank, "routine");
    expect(r.blank.correct_option).toBe("routine");
    expect(r.blank.options).toHaveLength(4);
    expect(new Set(r.blank.options).size).toBe(4);
    expect(r.blank.options).toContain("routine");
    expect(r.blank.options).toContain("daily"); // the old answer stays on as a wrong choice
    expect(r.replacedOption).toBe("daily's");
  });

  it("just takes the answer for a typed-in blank", () => {
    const r = applyAnswer({ index: 2, options: null, correct_option: "x" }, "y");
    expect(r.blank).toEqual({ index: 2, options: null, correct_option: "y" });
  });
});
