import { describe, expect, it } from "vitest";

import { loginSchema, validateLogin } from "./login-schema";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "student@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace from the email", () => {
    const result = loginSchema.safeParse({
      email: "  student@example.com  ",
      password: "x",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("student@example.com");
    }
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email?.[0]).toBeTruthy();
    }
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "student@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toBeTruthy();
    }
  });

  it("rejects both fields being wrong at once", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.email?.[0]).toBeTruthy();
      expect(fieldErrors.password?.[0]).toBeTruthy();
    }
  });

  it("rejects non-string input rather than throwing", () => {
    const result = loginSchema.safeParse({ email: 12345, password: null });
    expect(result.success).toBe(false);
  });
});

describe("validateLogin", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateLogin({
      email: "admin@kalindri.test",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "admin@kalindri.test",
        password: "hunter2",
      });
    }
  });

  it("returns field-level errors for a malformed email, no password error", () => {
    const result = validateLogin({
      email: "not-an-email",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.email).toBeTruthy();
      expect(result.fieldErrors.password).toBeUndefined();
    }
  });

  it("returns field-level errors for an empty password, no email error", () => {
    const result = validateLogin({
      email: "admin@kalindri.test",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.password).toBeTruthy();
      expect(result.fieldErrors.email).toBeUndefined();
    }
  });

  it("returns both field errors when both are invalid", () => {
    const result = validateLogin({ email: "nope", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.email).toBeTruthy();
      expect(result.fieldErrors.password).toBeTruthy();
    }
  });
});
