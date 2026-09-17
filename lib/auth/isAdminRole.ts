/**
 * Pure role check, extracted out of requireAdmin.ts so it's testable
 * without a live Supabase session. Takes a bare `string` (not the
 * `userRole` enum type) on purpose — the whole point is to also handle an
 * unexpected/malformed value safely rather than assume it's always one of
 * the three known roles.
 */
export function isAdminRole(role: string): boolean {
  return role === "admin";
}
