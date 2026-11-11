import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { beginRegistration } from "@/lib/security/webauthn";

/** Registers a passkey for the SIGNED-IN persona only. The identity is never taken from the request body. */
export async function POST(req: NextRequest) {
  const g = await requireAccess(req, "staff");
  if (g instanceof NextResponse) return g;
  const limited = limitRequest(req, "passkey-register-options", { limit: 10 }, g.sid);
  if (limited) return limited;
  try {
    return NextResponse.json({ options: await beginRegistration(g.sub, g.name) });
  } catch (err) {
    return safeError(err, "Could not start passkey registration.", 500);
  }
}
