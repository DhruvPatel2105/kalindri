import { describe, expect, it } from "vitest";

import { isProtectedPath, isPublicPath } from "./routes";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats the home page as protected", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("treats every other app route as protected — no public dashboard", () => {
    for (const path of [
      "/dashboard",
      "/practice",
      "/practice/read-aloud",
      "/admin",
      "/admin/questions",
      "/results/123",
    ]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("treats Next.js static asset internals as public", () => {
    expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isPublicPath("/_next/image?url=%2Ffoo.png")).toBe(true);
  });

  it("treats favicon.ico as public", () => {
    expect(isPublicPath("/favicon.ico")).toBe(true);
  });

  it("does not treat a path that merely contains 'login' as public", () => {
    expect(isPublicPath("/login-history")).toBe(false);
    expect(isPublicPath("/admin/login-attempts")).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it("is the exact inverse of isPublicPath", () => {
    for (const path of [
      "/",
      "/login",
      "/dashboard",
      "/_next/static/chunks/main.js",
      "/favicon.ico",
    ]) {
      expect(isProtectedPath(path)).toBe(!isPublicPath(path));
    }
  });
});
