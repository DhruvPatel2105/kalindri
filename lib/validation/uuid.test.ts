import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("47277dad-0759-4d44-b6e5-cc1dc7ebcd48")).toBe(true);
    expect(isUuid("47277DAD-0759-4D44-B6E5-CC1DC7EBCD48")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "abc", "47277dad07594d44b6e5cc1dc7ebcd48", "47277dad-0759-4d44-b6e5-cc1dc7ebcd4", " 47277dad-0759-4d44-b6e5-cc1dc7ebcd48", "results"]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});
