import { describe, expect, it } from "vitest";

import { parseReorderFile } from "./parseReorder";

const GOOD = `#1 Snow Removal
Answer: 3, 1, 2, 4
1. Crews then salt the main roads.
2. Side streets are cleared last.
3. The city declares a snow event when a storm is forecast.
4. Residents are asked to move parked cars.
`;

describe("parseReorderFile", () => {
  it("converts the reading-order answer into boxes in correct order", () => {
    const { items, fileErrors } = parseReorderFile(GOOD);
    expect(fileErrors).toEqual([]);
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.title).toBe("Snow Removal");
      expect(item.payload.boxes).toEqual([
        "The city declares a snow event when a storm is forecast.",
        "Crews then salt the main roads.",
        "Side streets are cleared last.",
        "Residents are asked to move parked cars.",
      ]);
    }
  });

  it("accepts Answer on the header line with a stray trailing ]", () => {
    const { items } = parseReorderFile(
      "#2 Library Hours Answer: 2, 1]\n1. Second thing.\n2. First thing.\n",
    );
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.title).toBe("Library Hours");
      expect(item.payload.boxes).toEqual(["First thing.", "Second thing."]);
    }
  });

  it("joins a sentence wrapped over several lines", () => {
    const { items } = parseReorderFile(
      "#1 T\nAnswer: 1, 2\n1. A long sentence that\n   wraps here.\n2. Short one.\n",
    );
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.payload.boxes[0]).toBe("A long sentence that wraps here.");
    }
  });

  it("rejects an answer that is not a permutation", () => {
    const { items } = parseReorderFile(
      "#1 T\nAnswer: 1, 1, 2\n1. a\n2. b\n3. c\n",
    );
    const item = items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors[0]).toContain("exactly once");
  });

  it("rejects a missing answer line", () => {
    const { items } = parseReorderFile("#1 T\n1. a\n2. b\n");
    const item = items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors[0]).toContain("Missing");
  });

  it("rejects out-of-order sentence numbering", () => {
    const { items } = parseReorderFile("#1 T\nAnswer: 1, 2\n2. b\n1. a\n");
    expect(items[0]?.ok).toBe(false);
  });

  it("rejects fewer than two sentences", () => {
    const { items } = parseReorderFile("#1 T\nAnswer: 1\n1. only one\n");
    expect(items[0]?.ok).toBe(false);
  });

  it("parses several questions and keeps good ones when another is bad", () => {
    const { items } = parseReorderFile(`${GOOD}\n#2 Bad\nAnswer: 1, 2\n1. a\n`);
    expect(items.map((i) => i.ok)).toEqual([true, false]);
  });
});
