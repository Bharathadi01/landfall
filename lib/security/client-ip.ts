/**
 * Best-effort client IP behind a reverse proxy, without trusting what a caller can spoof.
 *
 * X-Forwarded-For is a list `client, proxy1, proxy2`; every proxy APPENDS the address it received the request
 * from. The left-most entries can be written by the caller, so we count from the RIGHT, past the number of
 * proxies we operate/trust (TRUSTED_PROXY_HOPS, default 1 = our host's load balancer).
 * If the platform exposes a single trusted header (e.g. cf-connecting-ip), set TRUSTED_IP_HEADER to use it.
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const trusted = env.TRUSTED_IP_HEADER?.toLowerCase();
  if (trusted) {
    const v = headers.get(trusted)?.trim();
    if (v) return v;
  }
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const hops = Math.max(1, parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
    const idx = parts.length - hops;
    if (parts.length > 0) return parts[Math.max(0, idx)];
  }
  return headers.get("x-real-ip")?.trim() || "local";
}
