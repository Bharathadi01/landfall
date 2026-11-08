import { db } from "./client";
import { auditEvents } from "./schema";

export async function logAuditEvent({
  actor,
  action,
  requestRedacted,
  responseRedacted,
  debugId,
}: {
  actor: string;
  action: string;
  requestRedacted?: unknown;
  responseRedacted?: unknown;
  debugId?: string;
}) {
  try {
    await db.insert(auditEvents).values({
      actor,
      action,
      requestRedacted: requestRedacted ? (requestRedacted as Record<string, unknown>) : null,
      responseRedacted: responseRedacted ? (responseRedacted as Record<string, unknown>) : null,
      debugId,
    });
  } catch (err) {
    // Audit log should not break main flow if DB is temporarily unreachable in dev/test
    console.error("[audit_events] Failed to write audit event:", err);
  }
}
