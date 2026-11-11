import { NextResponse } from "next/server";
import { ZodError } from "zod";
import crypto from "node:crypto";

/**
 * Safe error responses. The real error is logged server-side with a short reference; the client only ever
 * sees a fixed, human message plus that reference. No host, port, SQL, stack or upstream (PayPal/Groq) text
 * reaches a browser. Validation (Zod) errors are the one exception: they describe the caller's own input.
 */
export function errorRef(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function safeError(err: unknown, publicMessage: string, status = 500): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid_request", message: "Some fields are missing or invalid.", issues: err.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 }
    );
  }
  const ref = errorRef();
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`[api-error ${ref}] ${publicMessage} — ${detail.slice(0, 500)}`);
  return NextResponse.json({ error: "request_failed", message: publicMessage, ref }, { status });
}

/** For UI banners: never display a raw server/network message. */
export function friendlyClientError(res: { status: number } | null | undefined, fallback: string): string {
  if (!res) return `${fallback} Check your connection and try again.`;
  if (res.status === 401) return "Please sign in to continue.";
  if (res.status === 403) return "Your role doesn't allow this action.";
  if (res.status === 429) return "Too many requests — wait a minute and try again.";
  if (res.status >= 500) return `${fallback} This was logged; try again shortly.`;
  return fallback;
}
