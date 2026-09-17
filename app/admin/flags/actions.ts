"use server";

/**
 * Flag status-transition Server Actions. Flags are informational only —
 * CLAUDE.md: "Auto-block a flagged account — flags are for manual admin
 * review only." Neither action here touches users.is_active or
 * active_sessions in any way; deactivation, if warranted, is the admin's
 * own separate, deliberate use of toggleUserActiveAction
 * (app/admin/users/actions.ts) — not built again here.
 *
 * resolveFlagAction and dismissFlagAction share the exact same
 * org-check/re-verification shape via transitionFlag() on purpose, per the
 * task: "don't let these two actions diverge structurally from each other
 * for no reason."
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDb } from "@/lib/db";
import { accountFlags, auditLog } from "@/lib/db/schema";

async function transitionFlag(
  flagId: string,
  nextStatus: "reviewed" | "dismissed",
  auditAction: "resolve_flag" | "dismiss_flag",
): Promise<void> {
  const admin = await requireAdmin();
  const db = getDb();

  const [flag] = await db
    .select()
    .from(accountFlags)
    .where(eq(accountFlags.id, flagId))
    .limit(1);

  if (!flag || flag.orgId !== admin.orgId) {
    throw new Error("Flag not found.");
  }

  await db
    .update(accountFlags)
    .set({
      status: nextStatus,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    })
    .where(eq(accountFlags.id, flag.id));

  await db.insert(auditLog).values({
    orgId: admin.orgId,
    actorUserId: admin.id,
    action: auditAction,
    targetType: "account_flag",
    targetId: flag.id,
    details: { reason: flag.reason, userId: flag.userId },
  });

  revalidatePath("/admin/flags");
  // Also refresh the shared layout — the open-flag count badge in the nav
  // lives there, not on this page.
  revalidatePath("/admin", "layout");
}

export async function resolveFlagAction(flagId: string): Promise<void> {
  await transitionFlag(flagId, "reviewed", "resolve_flag");
}

export async function dismissFlagAction(flagId: string): Promise<void> {
  await transitionFlag(flagId, "dismissed", "dismiss_flag");
}
