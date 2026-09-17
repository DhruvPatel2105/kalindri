"use client";

import { useState, useTransition } from "react";

import { createUserAction, type CreateUserResult } from "./actions";

/**
 * The one-time password panel below lives only in this component's local
 * state — never in a cookie, storage, or URL — so a page refresh simply
 * loses it, matching "nothing to refresh it FROM" (the password isn't
 * stored anywhere retrievable after this response).
 */
export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const result = await createUserAction(email, role);
        setCreated(result);
        setEmail("");
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
    if (!created) return;
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
        <div className="flex flex-col gap-2 rounded border-l-[3px] border-[#1f6f6b] bg-[#fafaf8] p-3">
          <p className="text-sm font-medium text-[#1e2a2a]">
            Account created. This password is shown once — copy it now; it
            cannot be retrieved again after you leave this page.
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
      ) : null}
    </div>
  );
}
