import { NextResponse } from "next/server";
import { getPasskeyRegistrationOptions } from "@/lib/security/passkeys";
import { safeError } from "@/lib/http/safe-error";
import { limitRequest } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const limited = limitRequest(req, "auth-passkey-register-options-post", { limit: 20 });
  if (limited) return limited;

  try {
    const { userId, userName } = await req.json();
    if (!userId || !userName) {
      return NextResponse.json({ error: "userId and userName are required" }, { status: 400 });
    }

    const options = await getPasskeyRegistrationOptions(userId, userName);
    return NextResponse.json(options);
  } catch (err: any) {
    return safeError(err, "Failed to generate registration options", 500);
  }
}

