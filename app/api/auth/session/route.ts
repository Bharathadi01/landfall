import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, sessionCookieAttributes, signSession, verifySession } from "@/lib/auth/session";
import { personaById } from "@/lib/auth/personas";
import { limitRequest } from "@/lib/security/rate-limit";
import { safeError } from "@/lib/http/safe-error";

/**
 * GET    current session (public; says who you are, never anything secret)
 * POST   operator sign-in as a DEMO PERSONA (one click, for judges and rehearsal). Disabled when JUDGE_MODE_ENABLED=false.
 * DELETE sign out (operators and residents)
 */
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, session: { id: s.sub, name: s.name, role: s.role, household: s.hh ?? null, expiresAt: new Date(s.exp * 1000).toISOString(), demo: true } });
}

const Body = z.object({ persona: z.string().min(1).max(40) });

export async function POST(req: NextRequest) {
  if (process.env.JUDGE_MODE_ENABLED === "false") {
    return NextResponse.json({ error: "demo_sign_in_disabled", message: "Demo persona sign-in is disabled on this deployment." }, { status: 403 });
  }
  const limited = limitRequest(req, "signin", { limit: 20 });
  if (limited) return limited;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    const persona = parsed.success ? personaById(parsed.data.persona) : undefined;
    if (!persona) return NextResponse.json({ error: "unknown_persona", message: "Choose one of the listed demo personas." }, { status: 400 });
    const token = await signSession({ sub: persona.id, name: persona.name, role: persona.role });
    const res = NextResponse.json({ ok: true, session: { name: persona.name, title: persona.title, role: persona.role, demo: true } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieAttributes());
    return res;
  } catch (err) {
    return safeError(err, "Could not sign in", 500);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieAttributes(), maxAge: 0 });
  return res;
}
