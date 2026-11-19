"use client";

import { useState, useTransition } from "react";

import { chosenPasswordProblem, MIN_PASSWORD_LENGTH } from "@/lib/auth/chosenPassword";

import { createUserAction, type CreateUserResult } from "./actions";

/**
 * The one-time password panel below lives only in this component's local
 * state — never in a cookie, storage, or URL — so a page refresh simply
 * loses it, matching "nothing to refresh it FROM" (the password isn't
 * stored anywhere retrievable after this response).
 */
export function CreateUserForm() {
  const [email, setEmail] = useState("");
  // Empty = generate a password; anything typed is used as the password.
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "admin">("student");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);
    const problem = password ? chosenPasswordProblem(password) : null;
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      try {
        const result = await createUserAction(email, role, password);
        setCreated(result);
        setEmail("");
        setPassword("");
        setRole("student");
      } catch (err) {
        setCreated(null);
        setError(
          err instanceof Error ? err.message : "Failed to create user.",
        );
      }
    });
  }

  async function handleCopy() {
    if (!created?.password) return;
    await navigator.clipboard.writeText(
      `Email: ${created.email} / Password: ${created.password}`,
    );
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4 rounded border border-[#ddd9d0] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#1e2a2a]">Create user</h3>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="new-user-email"
            className="text-xs font-medium text-[#5c6a68]"
          >
            Email
          </label>
          <input
            id="new-user-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border border-[#ddd9d0] bg-white px-3 py-1.5 text-sm text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="new-user-role"
            className="text-xs font-medium text-[#5c6a68]"
          >
            Role
          </label>
          <select
            id="new-user-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "student" | "admin")
            }
            className="rounded border border-[#ddd9d0] bg-white px-3 py-1.5 text-sm text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
          >
            <option value="student">student</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="new-user-password"
            className="text-xs font-medium text-[#5c6a68]"
          >
            Password <span className="font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="new-user-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to generate"
              minLength={password ? MIN_PASSWORD_LENGTH : undefined}
              className="w-56 rounded border border-[#ddd9d0] bg-white px-3 py-1.5 text-sm text-[#1e2a2a] focus:border-[#1f6f6b] focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-[#5c6a68]">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Show
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[#1f6f6b] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17544f] disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create user"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-[#b0472f]">
          {error}
        </p>
      ) : null}

      {created ? (
        created.password ? (
          <div className="flex flex-col gap-2 rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-3">
            <p className="text-sm font-medium text-[#1e2a2a]">
              Account created. This generated password is shown once — copy it
              now; it cannot be retrieved again after you leave this page.
            </p>
            <p className="font-mono text-sm text-[#1e2a2a]">
              Email: {created.email}
              <br />
              Password: {created.password}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-fit rounded bg-[#1f6f6b] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17544f]"
            >
              {copied ? "Copied!" : "Copy credentials"}
            </button>
          </div>
        ) : (
          <div className="rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-3">
            <p className="text-sm font-medium text-[#1e2a2a]">
              Account created for {created.email} with the password you chose.
              It isn&apos;t shown again — share it with the student yourself.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
