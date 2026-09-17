/**
 * Login form validation — CLAUDE.md "Zod validation at every boundary".
 *
 * Runs before Supabase is ever called, so a malformed request (bad email
 * shape, empty password) fails fast with a field-level error instead of
 * spending an auth round trip on input that could never succeed.
 */

import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Per-field messages, in `loginSchema`'s own field order. Never a generic blob. */
export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

/** Runs `loginSchema` and reshapes Zod's errors into the field-keyed error object the form renders. */
export function validateLogin(
  input: unknown,
):
  | { success: true; data: LoginInput }
  | { success: false; fieldErrors: LoginFieldErrors } {
  const parsed = loginSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const flattened = parsed.error.flatten().fieldErrors;
  return {
    success: false,
    fieldErrors: {
      email: flattened.email?.[0],
      password: flattened.password?.[0],
    },
  };
}
