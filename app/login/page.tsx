import { LoginForm } from "./login-form";

const REASON_MESSAGES: Record<string, string> = {
  "signed-in-elsewhere":
    "You were signed out because this account signed in somewhere else.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const reasonMessage = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f4f2ee] px-4">
      <h1 className="text-2xl font-semibold text-[#1e2a2a]">Kalindri</h1>
      {reasonMessage ? (
        <p
          role="status"
          className="max-w-sm text-center text-sm text-[#5c6a68]"
        >
          {reasonMessage}
        </p>
      ) : null}
      <LoginForm />
    </main>
  );
}
