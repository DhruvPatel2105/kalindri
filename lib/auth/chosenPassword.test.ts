import { describe, expect, it } from "vitest";

import { chosenPasswordProblem, MAX_PASSWORD_LENGTH } from "./chosenPassword";

describe("chosenPasswordProblem", () => {
  it("accepts a normal password", () => {
    expect(chosenPasswordProblem("Example-Password-1")).toBeNull();
    expect(chosenPasswordProblem("exactly8")).toBeNull();
    expect(chosenPasswordProblem("with spaces inside ok")).toBeNull();
  });

  it("refuses one that is too short", () => {
    expect(chosenPasswordProblem("")).toMatch(/at least 8/);
    expect(chosenPasswordProblem("1234567")).toMatch(/at least 8/);
  });

  it("refuses one over 72 bytes (bcrypt ignores the rest)", () => {
    expect(chosenPasswordProblem("a1".repeat(36))).toBeNull(); // 72
    expect(chosenPasswordProblem("a1".repeat(36) + "x")).toMatch(/at most 72/);
    expect(chosenPasswordProblem("é".repeat(40))).toMatch(/at most 72/); // 80 bytes
    expect(MAX_PASSWORD_LENGTH).toBe(72);
  });

  it("refuses leading or trailing spaces instead of silently trimming", () => {
    expect(chosenPasswordProblem(" Example-Password-1")).toMatch(/space/);
    expect(chosenPasswordProblem("Example-Password-1 ")).toMatch(/space/);
  });

  it("refuses a single repeated character", () => {
    expect(chosenPasswordProblem("aaaaaaaa")).toMatch(/repeated/);
  });
});
