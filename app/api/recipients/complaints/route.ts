import { NextRequest, NextResponse } from "next/server";
import { registerComplaint, type ComplaintCategory } from "@/lib/recipients/complaints";
import { z } from "zod";
import { safeError } from "@/lib/http/safe-error";
import { getSession, mayAccessHousehold } from "@/lib/auth/guard";
import { maskEmail } from "@/lib/security/mask";
import { limitRequest } from "@/lib/security/rate-limit";

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
  const limited = limitRequest(req, "complaint-submit", { limit: 6 });
  if (limited) return limited;
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
    return safeError(err, "Request failed", 500);
  }
}

/**
 * Complaints. With a household id: that household's own complaints (resident session for that household, or any operator).
 * Without one: the full list, operators only. Contact emails are masked for operators and never returned to residents.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  const householdId = new URL(req.url).searchParams.get("householdId");

  if (householdId) {
    if (!mayAccessHousehold(session, householdId)) return NextResponse.json({ complaints: [] });
    const mine = complaintsCache.filter((c) => c.householdId === householdId).map(({ contactEmail, ...rest }) => rest);
    return NextResponse.json({ complaints: mine });
  }
  if (!session || session.role === "resident") {
    return NextResponse.json({ error: "forbidden", message: "Your role doesn't allow this action." }, { status: 403 });
  }
  return NextResponse.json({ complaints: complaintsCache.map((c) => ({ ...c, contactEmail: maskEmail(c.contactEmail) })) });
}
