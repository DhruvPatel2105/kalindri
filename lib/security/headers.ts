/**
 * Security headers sent with every response. Pure, so they are unit-tested.
 *
 *  - Strict-Transport-Security   browsers only ever use https for this site
 *  - X-Content-Type-Options      no guessing a file's type
 *  - X-Frame-Options / frame-ancestors   the site can't be put in someone else's frame
 *  - Referrer-Policy             other sites only see our origin, never a full page address
 *  - Permissions-Policy          camera and location off; the microphone only for this site (speaking tasks)
 *  - Content-Security-Policy     scripts, styles, images, audio and connections only from
 *                                this site (and Supabase, for sign-in and private audio);
 *                                no plugins, no <base> tricks, forms only post back here.
 *
 * Scripts and styles allow 'unsafe-inline' because Next.js writes small inline
 * scripts and the pages use inline style attributes; everything else about the
 * policy is strict. (A nonce-based policy would remove that and is a later step.)
 */

export interface HeaderEntry {
  key: string;
  value: string;
}

export function contentSecurityPolicy(isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    // Next's dev server needs eval for hot reload; production never does.
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: https://*.supabase.co",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDevelopment ? " ws://localhost:* http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDevelopment) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(isDevelopment: boolean): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDevelopment) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
