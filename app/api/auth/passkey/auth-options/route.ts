import { NextResponse } from "next/server";
import { getPasskeyAuthOptionsForPlan } from "@/lib/security/passkeys";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const limited = limitRequest(req, "auth-passkey-auth-options-post", { limit: 20 });
  if (limited) return limited;

  try {
    const { planHash } = await req.json();
    if (!planHash) {
      return NextResponse.json({ error: "planHash is required for plan authorization" }, { status: 400 });
    }

    const options = await getPasskeyAuthOptionsForPlan(planHash);
    return NextResponse.json(options);
  } catch (err: any) {
    return safeError(err, "Failed to generate auth options", 500);
  }
}

