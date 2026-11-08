import { db } from "@/lib/db/client";
import { piiAccessLog } from "@/lib/db/schema";

export type Role = "resident" | "volunteer" | "coordinator" | "finance" | "admin";

export type Permission =
  | "view_public"
  | "enroll_self"
  | "assisted_enroll"
  | "view_masked_case"
  | "view_decrypted_pii"
  | "draft_plan"
  | "approve_plan_coordinator"
  | "approve_plan_finance"
  | "execute_treasurer"
  | "manage_hosts";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  resident: ["view_public", "enroll_self"],
  volunteer: ["view_public", "assisted_enroll", "view_masked_case"],
  coordinator: [
    "view_public",
    "assisted_enroll",
    "view_masked_case",
    "view_decrypted_pii",
    "draft_plan",
    "approve_plan_coordinator",
  ],
  finance: [
    "view_public",
    "view_masked_case",
    "view_decrypted_pii",
    "draft_plan",
    "approve_plan_finance",
    "execute_treasurer",
  ],
  admin: [
    "view_public",
    "assisted_enroll",
    "view_masked_case",
    "view_decrypted_pii",
    "draft_plan",
    "approve_plan_coordinator",
    "approve_plan_finance",
    "execute_treasurer",
    "manage_hosts",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Audit every PII read into immutable pii_access_log.
 */
export async function logPIIAccess({
  actorId,
  actorRole,
  resourceType,
  resourceId,
  accessedFields,
  reason = "plan_review",
}: {
  actorId: string;
  actorRole: Role;
  resourceType: "household" | "document";
  resourceId: string;
  accessedFields: string[];
  reason?: string;
}): Promise<void> {
  try {
    await db.insert(piiAccessLog).values({
      actorId,
      actorRole,
      resourceType,
      resourceId,
      accessedFields,
      reason,
    });
  } catch (err) {
    console.error("[PII_ACCESS_LOG] Failed to write PII access log:", err);
  }
}
