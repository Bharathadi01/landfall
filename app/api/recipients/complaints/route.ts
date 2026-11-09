import { NextRequest, NextResponse } from "next/server";
import { registerComplaint, type ComplaintCategory } from "@/lib/recipients/complaints";
import { z } from "zod";

const SubmitComplaintSchema = z.object({
  householdId: z.string().min(1),
  category: z.enum([
    "EXCLUSION_DISPUTE",
    "PAYMENT_METHOD_CHANGE",
    "VULNERABILITY_UPDATE",
    "UNCLAIMED_ASSISTANCE",
    "GENERAL_INQUIRY",
  ]),
  description: z.string().min(5),
  contactEmail: z.string().email(),
});

// In-memory persistent cache for demo/hackathon session
const complaintsCache: any[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SubmitComplaintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const complaint = registerComplaint(parsed.data);
    complaintsCache.unshift(complaint);

    return NextResponse.json({
      success: true,
      complaint,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get("householdId");

  if (householdId) {
    const filtered = complaintsCache.filter((c) => c.householdId === householdId);
    return NextResponse.json({ complaints: filtered });
  }

  return NextResponse.json({ complaints: complaintsCache });
}

