import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const recentAuditEvents = await db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(30);

    return NextResponse.json({
      status: "ok",
      auditEvents: recentAuditEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
