import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#f4f2ee] px-4">
      <h1 className="text-2xl font-semibold text-[#1e2a2a]">Kalindri</h1>
      <LoginForm />
    </main>
  );
}
