import { describe, expect, it } from "vitest";

import { BOOKMARK_COLORS, isBookmarkColor } from "./bookmarkColors";

describe("isBookmarkColor", () => {
  it("accepts the four colours", () => {
    expect(BOOKMARK_COLORS).toEqual(["red", "orange", "yellow", "green"]);
    for (const color of BOOKMARK_COLORS) expect(isBookmarkColor(color)).toBe(true);
  });

  it("rejects anything else, including case variants and non-strings", () => {
    for (const bad of ["Red", "blue", "", null, undefined, 1, {}]) expect(isBookmarkColor(bad)).toBe(false);
  });
});
