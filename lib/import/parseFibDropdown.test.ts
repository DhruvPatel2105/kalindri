import { describe, expect, it } from "vitest";

import { parseFibDropdownFile } from "./parseFibDropdown";

const GOOD = `#1 Transit Pass
Riders [renew | renews | renewing | renewed] their pass each month and
[keep | keeps | keeping | kept] the receipt.
`;

// Constant random keeps the sort stable, so options stay in source order.
const stable = () => 0;

describe("parseFibDropdownFile", () => {
  it("takes the first option as correct and builds 1-based blank indexes", () => {
    const { items, fileErrors } = parseFibDropdownFile(GOOD, stable);
    expect(fileErrors).toEqual([]);
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      expect(item.payload.passage_with_blanks).toBe(
        "Riders {{1}} their pass each month and {{2}} the receipt.",
      );
      expect(item.payload.blanks.map((b) => b.index)).toEqual([1, 2]);
      expect(item.payload.blanks.map((b) => b.correct_option)).toEqual([
        "renew",
        "keep",
      ]);
      expect(item.payload.blanks[0]?.options).toHaveLength(4);
    }
  });

  it("shuffles option order but always keeps the correct option in the list", () => {
    let n = 0;
    const descending = () => 1 - n++ * 0.1;
    const { items } = parseFibDropdownFile(GOOD, descending);
    const item = items[0];
    expect(item?.ok).toBe(true);
    if (item?.ok) {
      const first = item.payload.blanks[0];
      expect(first?.options?.[0]).not.toBe("renew");
      expect([...(first?.options ?? [])].sort()).toEqual(
        ["renew", "renews", "renewing", "renewed"].sort(),
      );
      expect(first?.options).toContain(first?.correct_option);
    }
  });

  it("names the blank when it only has the correct answer (no wrong options)", () => {
    const { items } = parseFibDropdownFile(
      "#1 T\nShe was [daily] and [late | later | latest | lately].\n",
      stable,
    );
    const item = items[0];
    expect(item?.ok).toBe(false);
    if (item && !item.ok) {
      expect(item.errors[0]).toContain("Blank 1 has 1 option");
    }
  });

  it("rejects 3 or 5 options and repeated options", () => {
    expect(
      parseFibDropdownFile("#1 T\n[a | b | c].\n", stable).items[0]?.ok,
    ).toBe(false);
    expect(
      parseFibDropdownFile("#1 T\n[a | b | c | d | e].\n", stable).items[0]?.ok,
    ).toBe(false);
    expect(
      parseFibDropdownFile("#1 T\n[a | b | B | d].\n", stable).items[0]?.ok,
    ).toBe(false);
  });

  it("rejects text with no blanks", () => {
    expect(parseFibDropdownFile("#1 T\nNo blanks here.\n", stable).items[0]?.ok).toBe(false);
  });
});
