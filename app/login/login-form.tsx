"use client";

import { useActionState } from "react";

import { login, type LoginFormState } from "@/lib/auth/actions";

const initialState: LoginFormState = {};

/**
 * No "sign up" link or affordance anywhere on this page — PRD: no
 * self-signup, admin provisioning only (see lib/db/create-admin.ts).
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-[#1e2a2a]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="rounded border border-[#ddd9d0] bg-white px-3 py-2 text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" role="alert" className="text-sm text-[#b0472f]">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-[#1e2a2a]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          className="rounded border border-[#ddd9d0] bg-white px-3 py-2 text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" role="alert" className="text-sm text-[#b0472f]">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[#1f6f6b] px-4 py-2 font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
