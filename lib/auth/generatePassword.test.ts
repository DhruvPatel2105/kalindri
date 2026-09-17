import { describe, expect, it } from "vitest";

import { generatePassword } from "./generatePassword";

describe("generatePassword", () => {
  it("is at least 12 characters long", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword().length).toBeGreaterThanOrEqual(12);
    }
  });

  it("always includes a lowercase letter", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/[a-z]/);
    }
  });

  it("always includes an uppercase letter", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/[A-Z]/);
    }
  });

  it("always includes a digit", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/[0-9]/);
    }
  });

  it("always includes a symbol", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it("produces distinct output across 1000 calls — no collisions", () => {
    const passwords = new Set(
      Array.from({ length: 1000 }, () => generatePassword()),
    );
    expect(passwords.size).toBe(1000);
  });

  it("does not use Math.random", () => {
    const original = Math.random;
    let calledMathRandom = false;
    Math.random = () => {
      calledMathRandom = true;
      return original();
    };
    try {
      generatePassword();
    } finally {
      Math.random = original;
    }
    expect(calledMathRandom).toBe(false);
  });
});
