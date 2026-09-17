import { describe, expect, it } from "vitest";

import { sessionMatches } from "./sessionMatch";

describe("sessionMatches", () => {
  it("matches when the cookie token equals the stored token", () => {
    expect(sessionMatches("abc-123", "abc-123")).toBe(true);
  });

  it("does not match when tokens differ", () => {
    expect(sessionMatches("abc-123", "xyz-999")).toBe(false);
  });

  it("does not match when the cookie is missing (undefined)", () => {
    expect(sessionMatches(undefined, "abc-123")).toBe(false);
  });

  it("does not match when no active_sessions row exists (stored token undefined)", () => {
    expect(sessionMatches("abc-123", undefined)).toBe(false);
  });

  it("does not match when both are missing", () => {
    expect(sessionMatches(undefined, undefined)).toBe(false);
  });

  it("does not match an empty-string cookie token", () => {
    expect(sessionMatches("", "abc-123")).toBe(false);
  });

  it("does not match an empty-string stored token", () => {
    expect(sessionMatches("abc-123", "")).toBe(false);
  });

  it("is case-sensitive — a differently-cased token never matches", () => {
    expect(sessionMatches("ABC-123", "abc-123")).toBe(false);
  });

  it("does not match on a partial/prefix overlap", () => {
    expect(sessionMatches("abc-123", "abc-1234")).toBe(false);
  });
});
