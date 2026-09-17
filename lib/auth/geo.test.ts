import { describe, expect, it } from "vitest";

import { extractGeoFromHeaders } from "./geo";

describe("extractGeoFromHeaders", () => {
  it("reads both headers when present", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "CA",
      "x-vercel-ip-city": "Toronto",
    });
    expect(extractGeoFromHeaders(headers)).toEqual({
      country: "CA",
      city: "Toronto",
    });
  });

  it("returns nulls when both headers are absent — the expected local-dev case", () => {
    const headers = new Headers();
    expect(extractGeoFromHeaders(headers)).toEqual({
      country: null,
      city: null,
    });
  });

  it("returns a null city when only the country header is present", () => {
    const headers = new Headers({ "x-vercel-ip-country": "US" });
    expect(extractGeoFromHeaders(headers)).toEqual({
      country: "US",
      city: null,
    });
  });

  it("returns a null country when only the city header is present", () => {
    const headers = new Headers({ "x-vercel-ip-city": "Austin" });
    expect(extractGeoFromHeaders(headers)).toEqual({
      country: null,
      city: "Austin",
    });
  });

  it("never throws given a minimal object exposing only get()", () => {
    const headers = { get: () => null };
    expect(() => extractGeoFromHeaders(headers)).not.toThrow();
  });
});
