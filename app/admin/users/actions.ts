"use server";

/**
 * User creation and deactivation Server Actions — reuses
 * lib/db/create-admin.ts's own patterns (idempotency check, explicit id
 * passthrough, Auth-user rollback on DB failure) inside the running app.
 *
 * Called directly from Client Components (app/admin/users/CreateUserForm.tsx,
 * ToggleActiveButton.tsx), not bound to a <form action>, so each re-verifies
 * requireAdmin() itself — the page that rendered the calling form isn't
 * what protects these; a Server Action is reachable independently of it.
 */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generatePassword } from "@/lib/auth/generatePassword";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { activeSessions, auditLog, users } from "@/lib/db/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: z.enum(["student", "admin"]),
});

export interface CreateUserResult {
  email: string;
  password: string;
}

export async function createUserAction(
  email: string,
  role: "student" | "admin",
): Promise<CreateUserResult> {
  const admin = await requireAdmin();

  const parsed = createUserSchema.safeParse({ email, role });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join("; "),
    );
  }
  const { email: validEmail, role: validRole } = parsed.data;

  const db = getDb();

  // Idempotency, scoped to the calling admin's org — same pattern as
  // lib/db/create-admin.ts. Note: users.email carries a GLOBAL unique
  // constraint (not per-org), so this check is a friendlier early error for
  // the common case; the DB insert below (and its rollback path) is the
  // real backstop if the email is taken in a different org.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, validEmail), eq(users.orgId, admin.orgId)))
    .limit(1);
  if (existing) {
    throw new Error(`A user with email "${validEmail}" already exists.`);
  }

  const password = generatePassword();
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: validEmail,
      password,
      email_confirm: true,
    });
  if (authError || !authData.user) {
    throw new Error(
      `Supabase Auth rejected user creation: ${authError?.message ?? "unknown error"}`,
    );
  }

  // `users.id` = the Auth user's id, EXACTLY — never the column's own
  // defaultRandom(). The one rule in this codebase that cannot be wrong.
  try {
    await db.insert(users).values({
      id: authData.user.id,
      orgId: admin.orgId,
      email: validEmail,
      role: validRole,
      isActive: true,
    });
  } catch (dbError) {
    // Roll back the orphaned Auth user so a retry isn't blocked by it.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw dbError;
  }

  await db.insert(auditLog).values({
    orgId: admin.orgId,
    actorUserId: admin.id,
    action: "create_user",
    targetType: "user",
    targetId: authData.user.id,
    details: { email: validEmail, role: validRole },
  });

  revalidatePath("/admin/users");

  // The ONLY time this plaintext password exists anywhere outside
  // Supabase's own hashed storage — never logged, never persisted by us.
  return { email: validEmail, password };
}

export async function toggleUserActiveAction(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const db = getDb();

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target || target.orgId !== admin.orgId) {
    // Refuse even in a single-org system, as a correctness rule — never
    // touch a row without confirming it's in the calling admin's org.
    throw new Error("User not found.");
  }

  if (target.id === admin.id) {
    throw new Error("You cannot deactivate your own account.");
  }

  const nextIsActive = !target.isActive;

  await db
    .update(users)
    .set({ isActive: nextIsActive })
    .where(eq(users.id, target.id));

  if (!nextIsActive) {
    // Deactivating: end their session immediately. requireActiveSession()
    // would eventually catch this on their next request regardless, but
    // don't make them wait if they're mid-session right now.
    await db.delete(activeSessions).where(eq(activeSessions.userId, target.id));
  }

  await db.insert(auditLog).values({
    orgId: admin.orgId,
    actorUserId: admin.id,
    action: nextIsActive ? "reactivate_user" : "deactivate_user",
    targetType: "user",
    targetId: target.id,
    details: { email: target.email },
  });

  revalidatePath("/admin/users");
}
