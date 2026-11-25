import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "./headers";

const value = (key: string, dev = false) => securityHeaders(dev).find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("sets every header the site relies on", () => {
    for (const key of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]) {
      expect(value(key)).toBeTruthy();
    }
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Strict-Transport-Security")).toMatch(/max-age=\d{8,}/);
  });

  it("only lets the microphone be used by this site, and keeps camera and location off", () => {
    const policy = value("Permissions-Policy") ?? "";
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
  });
});

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy(false);

  it("blocks framing, plugins, base-tag tricks and off-site form posts", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("never allows eval or other websites' scripts in production", () => {
    const script = prod.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(script).not.toContain("unsafe-eval");
    expect(script).not.toMatch(/https?:/);
    expect(script).toContain("'self'");
  });

  it("allows Supabase for sign-in and private audio, and nothing else off-site", () => {
    expect(prod).toContain("connect-src 'self' https://*.supabase.co");
    expect(prod).toContain("media-src 'self' blob: https://*.supabase.co");
    expect(prod).not.toMatch(/\*(?!\.supabase\.co)\S*\s/);
  });

  it("allows eval and local sockets only in development", () => {
    const dev = contentSecurityPolicy(true);
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws://localhost");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});
