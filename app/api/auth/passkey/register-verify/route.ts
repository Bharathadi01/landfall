import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/guard";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";
import { finishRegistration } from "@/lib/security/webauthn";

const Body = z.object({ response: z.record(z.string(), z.unknown()) });

export async function POST(req: NextRequest) {
  const g = await requireAccess(req, "staff");
  if (g instanceof NextResponse) return g;
  if (g.role !== "coordinator" && g.role !== "finance") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const limited = limitRequest(req, "passkey-register-verify", { limit: 10 }, g.sid);
  if (limited) return limited;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return safeError(parsed.error, "Invalid registration.");
  try {
    const r = await finishRegistration(g.sub, g.name, g.role, parsed.data.response as never);
    if (!r.ok) return NextResponse.json({ error: "bad_credentials", message: r.reason }, { status: 400 });
    return NextResponse.json({ ok: true, credentialId: r.credentialId });
  } catch (err) {
    return safeError(err, "Could not register the passkey.", 500);
  }
}
