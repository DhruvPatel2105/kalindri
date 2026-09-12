import { describe, expect, it } from "vitest";

import { normalise } from "./normalise";

describe("normalise", () => {
  it("lowercases", () => {
    expect(normalise("DOCTOR")).toBe("doctor");
  });

  it("strips punctuation", () => {
    expect(normalise("doctor!")).toBe("doctor");
    expect(normalise("well-known")).toBe("well known");
  });

  it("collapses and trims whitespace", () => {
    expect(normalise("  a   doctor  ")).toBe("doctor");
  });

  it("expands common contractions", () => {
    expect(normalise("it's broken")).toBe("it is broken");
    expect(normalise("I don't know")).toBe("i do not know");
    expect(normalise("they're here")).toBe("they are here");
  });

  it("expands contractions written with a curly apostrophe", () => {
    expect(normalise("it’s broken")).toBe("it is broken");
  });

  it("strips a single leading article", () => {
    expect(normalise("a doctor")).toBe("doctor");
    expect(normalise("an apple")).toBe("apple");
    expect(normalise("the doctor")).toBe("doctor");
  });

  it("does not strip a bare 'a' with nothing after it", () => {
    expect(normalise("a")).toBe("a");
  });

  it("only strips the leading article, not one later in the string", () => {
    expect(normalise("call a doctor")).toBe("call a doctor");
  });

  it("case, punctuation, whitespace and article combined", () => {
    expect(normalise("  A Doctor!  ")).toBe("doctor");
  });

  it("is idempotent", () => {
    const once = normalise("It's a Doctor!");
    expect(normalise(once)).toBe(once);
  });
});
