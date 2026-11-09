import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { stormPledges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { pledgeId } = await req.json();

    if (!pledgeId) {
      return NextResponse.json({ error: "pledgeId is required" }, { status: 400 });
    }

    const [revoked] = await db
      .update(stormPledges)
      .set({ status: "REVOKED" })
      .where(eq(stormPledges.id, pledgeId))
      .returning();

    if (!revoked) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Storm pledge revoked successfully. No further charges will be made.",
      pledge: revoked,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to revoke storm pledge" },
      { status: 500 }
    );
  }
}

