import { NextResponse } from "next/server";
import { getPasskeyAuthOptionsForPlan } from "@/lib/security/passkeys";
import { safeError } from "@/lib/http/safe-error";

export async function POST(req: Request) {
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

