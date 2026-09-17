import { describe, expect, it } from "vitest";

import { isAdminRole } from "./isAdminRole";

describe("isAdminRole", () => {
  it("is true for 'admin'", () => {
    expect(isAdminRole("admin")).toBe(true);
  });

  it("is false for 'student'", () => {
    expect(isAdminRole("student")).toBe(false);
  });

  it("is false for 'teacher' (a real role, just not admin)", () => {
    expect(isAdminRole("teacher")).toBe(false);
  });

  it("is false for an unexpected/unknown string", () => {
    expect(isAdminRole("superadmin")).toBe(false);
  });

  it("is false for an empty string", () => {
    expect(isAdminRole("")).toBe(false);
  });

  it("is case-sensitive — 'Admin' is not 'admin'", () => {
    expect(isAdminRole("Admin")).toBe(false);
  });
});
