import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { CONSOLE_PAGE, resolveApiRule, roleAllowed } from "@/lib/auth/policy";

/**
 * Edge middleware: the first of two gates (route handlers add finer checks).
 *  - /console/*  needs a console session, else redirect to /signin
 *  - /api/*      must match an explicit rule in lib/auth/policy.ts, else 403 (default deny)
 *  - state-changing API calls that carry a session cookie must be same-origin (CSRF defence in depth on top of SameSite=Lax)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/api/")) {
    const rule = resolveApiRule(pathname, method);
    if (!rule) {
      return NextResponse.json({ error: "forbidden", message: "This endpoint is not available." }, { status: 403 });
    }
    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (unsafe && cookie) {
      const origin = req.headers.get("origin");
      const fetchSite = req.headers.get("sec-fetch-site");
      const sameOrigin = origin ? new URL(origin).host === req.headers.get("host") : fetchSite ? fetchSite === "same-origin" || fetchSite === "none" : true;
      if (!sameOrigin) return NextResponse.json({ error: "cross_origin_blocked", message: "Cross-site request blocked." }, { status: 403 });
    }
    if (rule.access === "public" || rule.access === "webhook") return NextResponse.next();
    const session = await verifySession(cookie);
    if (rule.access === "cron" && !session) return NextResponse.next(); // the route checks CRON_SECRET itself
    if (!roleAllowed(rule.access, session)) {
      const unauth = !session;
      return NextResponse.json(
        { error: unauth ? "unauthenticated" : "forbidden", message: unauth ? "Please sign in to continue." : "Your role doesn't allow this action." },
        { status: unauth ? 401 : 403 }
      );
    }
    return NextResponse.next();
  }

  if (CONSOLE_PAGE.test(pathname)) {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!roleAllowed("operator", session)) {
      const url = req.nextUrl.clone();
      url.pathname = "/signin";
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // everything except Next internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
