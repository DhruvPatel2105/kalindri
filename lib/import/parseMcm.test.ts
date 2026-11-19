import { describe, expect, it } from "vitest";

import { parseMcmFile, parseMcsFile } from "./parseMcm";

const GOOD = `// EASY
#1 Recycling
Residents sort glass and cardboard.
Collection happens weekly.
Which are accepted?
* A) Glass bottles ✓
* B) Styrofoam
* C) Cardboard ✓
Answer: A, C
`;

describe("parseMcmFile", () => {
  it("builds the payload, joining passage lines and keeping option order", () => {
    const { items, fileErrors } = parseMcmFile(GOOD);
    expect(fileErrors).toEqual([]);
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.difficulty).toBe("easy");
      expect(item.payload.passage).toBe("Residents sort glass and cardboard. Collection happens weekly.");
      expect(item.payload.question).toBe("Which are accepted?");
      expect(item.payload.options.map((o) => o.id)).toEqual(["a", "b", "c"]);
      expect(item.payload.correct_option_ids).toEqual(["a", "c"]);
    }
  });

  it("works with only the Answer line or only the ticks", () => {
    const onlyAnswer = GOOD.replace(/ ✓/g, "");
    const onlyTicks = GOOD.replace(/Answer:.*\n/, "");
    for (const text of [onlyAnswer, onlyTicks]) {
      const item = parseMcmFile(text).items[0];
      expect(item?.ok).toBe(true);
      if (item?.ok) expect(item.payload.correct_option_ids.sort()).toEqual(["a", "c"]);
    }
  });

  it("rejects a key where the ticks and the Answer line disagree", () => {
    const item = parseMcmFile(GOOD.replace("Answer: A, C", "Answer: A, B")).items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors.join(" ")).toMatch(/disagree/);
  });

  it("reports missing options, missing key and unknown answer letters", () => {
    expect(parseMcmFile("#1 X\nPassage\nQuestion?\n").items[0]?.ok).toBe(false);
    const noKey = parseMcmFile("#1 X\nPassage\nQuestion?\n* A) one\n* B) two\n").items[0];
    expect(noKey?.ok).toBe(false);
    const badLetter = parseMcmFile("#1 X\nPassage\nQuestion?\n* A) one\n* B) two\nAnswer: Z\n").items[0];
    expect(badLetter?.ok).toBe(false);
  });
});

describe("parseMcsFile", () => {
  const SINGLE = `#1 Hegra
A passage.
Where does it appear?
* A) A textbook.
* B) A travel book. ✓
* C) A dictionary
Answer: B
`;

  it("builds a single correct_option_id", () => {
    const item = parseMcsFile(SINGLE).items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.payload.correct_option_id).toBe("b");
      expect(item.payload.options).toHaveLength(3);
    }
  });

  it("rejects more than one correct option", () => {
    const item = parseMcsFile(SINGLE.replace("* A) A textbook.", "* A) A textbook. ✓").replace("Answer: B", "Answer: A, B")).items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors.join(" ")).toMatch(/exactly one/);
  });

  it("rejects ticks that disagree with the Answer line, and stray text after the key", () => {
    expect(parseMcsFile(SINGLE.replace("Answer: B", "Answer: C")).items[0]?.ok).toBe(false);
    expect(parseMcsFile(SINGLE.replace("Answer: B", "Answer: B ⚠️ See note below.")).items[0]?.ok).toBe(false);
  });
});
