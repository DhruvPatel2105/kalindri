import { z } from "zod";

/**
 * Environment-variable boundary. Every variable the app reads is declared and
 * validated here with Zod — nothing else in the codebase should touch
 * `process.env` directly. See `.env.example` for the full list.
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

let serverEnvCache: ServerEnv | null = null;
let clientEnvCache: ClientEnv | null = null;

function format(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/** Validated server-only environment. Never import this into client components. */
export function serverEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${format(parsed.error)}`,
    );
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

/** Validated public environment. Safe to read from anywhere. */
export function clientEnv(): ClientEnv {
  if (clientEnvCache) return clientEnvCache;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${format(parsed.error)}`,
    );
  }
  clientEnvCache = parsed.data;
  return clientEnvCache;
}
