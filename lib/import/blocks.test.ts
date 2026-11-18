import { describe, expect, it } from "vitest";

import { extractBlanks, findDuplicates, joinLines, splitBlocks } from "./blocks";

describe("splitBlocks", () => {
  it("splits on #<number> headers and keeps titles", () => {
    const { blocks, errors } = splitBlocks(
      "#1 First\nline a\nline b\n\n#2 Second\nline c\n",
    );
    expect(errors).toEqual([]);
    expect(blocks.map((b) => [b.number, b.title])).toEqual([
      [1, "First"],
      [2, "Second"],
    ]);
    expect(blocks[0]?.lines).toEqual(["line a", "line b"]);
  });

  it("ignores // comment lines and CRLF line endings", () => {
    const { blocks, errors } = splitBlocks("// note\r\n#1 T\r\n// hidden\r\nbody\r\n");
    expect(errors).toEqual([]);
    expect(blocks[0]?.lines).toEqual(["body"]);
  });

  it("reports text before the first header", () => {
    const { errors } = splitBlocks("stray words\n#1 T\nbody");
    expect(errors[0]).toContain("before the first");
  });

  it("reports a repeated question number", () => {
    const { errors } = splitBlocks("#1 A\nx\n#1 B\ny");
    expect(errors).toContain("Question #1 appears more than once.");
  });
});

describe("extractBlanks", () => {
  it("numbers each [..] blank in order and returns the contents", () => {
    const result = extractBlanks("Go [to] the [store] now.");
    expect(result.passage).toBe("Go {{1}} the {{2}} now.");
    expect(result.contents).toEqual(["to", "store"]);
    expect(result.hasStrayBracket).toBe(false);
  });

  it("flags unbalanced brackets", () => {
    expect(extractBlanks("Go [to the store").hasStrayBracket).toBe(true);
    expect(extractBlanks("Go to] the store").hasStrayBracket).toBe(true);
  });
});

describe("joinLines / findDuplicates", () => {
  it("joins wrapped lines with single spaces", () => {
    expect(joinLines(["a  b", " c ", "d"])).toBe("a b c d");
  });

  it("finds case-insensitive duplicates once each", () => {
    expect(findDuplicates(["to", "From", "TO", "from", "to"])).toEqual([
      "TO",
      "from",
    ]);
  });
});
