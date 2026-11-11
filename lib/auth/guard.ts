import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, type Session } from "./session";
import { roleAllowed, type Access } from "./policy";

type ReqLike = { cookies: { get(name: string): { value: string } | undefined } };

export async function getSession(req: ReqLike): Promise<Session | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Route-level guard (defence in depth behind middleware).
 *   const g = await requireAccess(req, "staff"); if (g instanceof NextResponse) return g; const session = g;
 */
export async function requireAccess(req: ReqLike, access: Access): Promise<Session | NextResponse> {
  const session = await getSession(req);
  if (roleAllowed(access, session)) return session as Session;
  const unauth = !session;
  return NextResponse.json(
    { error: unauth ? "unauthenticated" : "forbidden", message: unauth ? "Please sign in to continue." : "Your role doesn't allow this action." },
    { status: unauth ? 401 : 403 }
  );
}

/** A resident may only touch their own household; operators may touch any. */
export function mayAccessHousehold(session: Session | null, householdId: string): boolean {
  if (!session) return false;
  if (session.role === "resident") return session.hh === householdId;
  return session.role === "coordinator" || session.role === "finance" || session.role === "viewer";
}
