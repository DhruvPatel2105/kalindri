/**
 * Vercel populates `x-vercel-ip-country` / `x-vercel-ip-city` on requests
 * that pass through its edge network. Locally (and on any other host)
 * these headers simply don't exist — `Headers.get()` returns `null` for a
 * missing header rather than throwing, so reading them never needs a
 * try/catch, and behaves identically in dev (always null) and on Vercel
 * (populated).
 */

export interface GeoInfo {
  country: string | null;
  city: string | null;
}

/** Structurally compatible with both the web `Headers` and Next's `ReadonlyHeaders`. */
export interface HeaderReader {
  get(name: string): string | null;
}

export function extractGeoFromHeaders(headers: HeaderReader): GeoInfo {
  return {
    country: headers.get("x-vercel-ip-country"),
    city: headers.get("x-vercel-ip-city"),
  };
}
