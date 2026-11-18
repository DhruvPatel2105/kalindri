import { describe, expect, it } from "vitest";

import { parseFibDragFile } from "./parseFibDrag";

const GOOD = `#1 Community Centre
The community centre [opens] at nine and [offers] swimming lessons for
every [age]. Registration is [online].
Unused: closes, hides, school
`;

describe("parseFibDragFile", () => {
  it("builds passage, ordered answers and a bank of answers + unused", () => {
    const { items, fileErrors } = parseFibDragFile(GOOD);
    expect(fileErrors).toEqual([]);
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.payload.passage_with_blanks).toBe(
        "The community centre {{1}} at nine and {{2}} swimming lessons for every {{3}}. Registration is {{4}}.",
      );
      expect(item.payload.correct_answers).toEqual([
        "opens",
        "offers",
        "age",
        "online",
      ]);
      expect(item.payload.word_bank).toEqual([
        "opens",
        "offers",
        "age",
        "online",
        "closes",
        "hides",
        "school",
      ]);
    }
  });

  it("rejects a missing Unused line", () => {
    const { items } = parseFibDragFile("#1 T\nGo [to] school.\n");
    const item = items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors[0]).toContain("Unused");
  });

  it("rejects an empty Unused line (needs at least one distractor)", () => {
    const { items } = parseFibDragFile("#1 T\nGo [to] school.\nUnused:\n");
    expect(items[0]?.ok).toBe(false);
  });

  it("rejects a duplicate word across answers and unused, ignoring case", () => {
    const { items } = parseFibDragFile("#1 T\nGo [to] the [store].\nUnused: To, from\n");
    const item = items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) expect(item.errors.join(" ")).toContain("duplicate");
  });

  it("rejects the same answer used for two blanks", () => {
    const { items } = parseFibDragFile("#1 T\n[the] cat saw [the] dog.\nUnused: a\n");
    expect(items[0]?.ok).toBe(false);
  });

  it("rejects text with no blanks and with unbalanced brackets", () => {
    expect(parseFibDragFile("#1 T\nNo blanks.\nUnused: a\n").items[0]?.ok).toBe(false);
    expect(parseFibDragFile("#1 T\nGo [to school.\nUnused: a\n").items[0]?.ok).toBe(false);
  });
});
