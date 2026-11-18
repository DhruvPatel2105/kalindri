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

describe("splitBlocks difficulty markers", () => {
  const text = [
    "// EASY",
    "#1 A",
    "body",
    "",
    "#2 B",
    "body",
    "// Medium",
    "#3 C",
    "body",
    "  // hard  ",
    "#4 D",
    "body",
  ].join("\n");

  it("gives each question the most recent // EASY|MEDIUM|HARD marker above it", () => {
    const { blocks } = splitBlocks(text);
    expect(blocks.map((b) => [b.number, b.difficulty])).toEqual([
      [1, "easy"],
      [2, "easy"],
      [3, "medium"],
      [4, "hard"],
    ]);
  });

  it("a marker doesn't leak into the question body, and is case and spacing tolerant", () => {
    const { blocks } = splitBlocks(text);
    expect(blocks[1]?.lines).toEqual(["body"]);
  });

  it("questions before any marker have no difficulty", () => {
    const { blocks } = splitBlocks("#1 A\nbody\n// HARD\n#2 B\nbody");
    expect(blocks.map((b) => b.difficulty)).toEqual([null, "hard"]);
  });

  it("other comments are still just comments, not markers", () => {
    const { blocks } = splitBlocks("// easy to read, this one\n// EASY!\n#1 A\nbody");
    expect(blocks[0]?.difficulty).toBeNull();
  });
});
