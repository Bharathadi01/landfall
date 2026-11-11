import { describe, it, expect } from "vitest";
import { signSession, verifySession, getSessionSecret } from "@/lib/auth/session";

const SECRET = "unit-test-secret-0123456789abcdef";
const base = { sub: "dana-ortiz", name: "Dana Ortiz", role: "coordinator" as const };

describe("signed sessions", () => {
  it("round-trips a valid session", async () => {
    const t = await signSession(base, { secret: SECRET });
    const s = await verifySession(t, { secret: SECRET });
    expect(s).toMatchObject({ sub: "dana-ortiz", role: "coordinator" });
    expect(s!.exp).toBeGreaterThan(s!.iat);
  });
  it("rejects a tampered payload (role escalation)", async () => {
    const t = await signSession({ ...base, role: "viewer" }, { secret: SECRET });
    const [body, sig] = t.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.role = "finance";
    const bad = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect(await verifySession(bad, { secret: SECRET })).toBeNull();
  });
  it("rejects a token signed with a different secret", async () => {
    const t = await signSession(base, { secret: "another-secret-another-secret-1234" });
    expect(await verifySession(t, { secret: SECRET })).toBeNull();
  });
  it("rejects expired, malformed and oversized tokens", async () => {
    const old = await signSession(base, { secret: SECRET, now: Date.now() - 9 * 3600_000 });
    expect(await verifySession(old, { secret: SECRET })).toBeNull();
    for (const junk of ["", "x", "a.b", "....", undefined, null, "A".repeat(3000)]) {
      expect(await verifySession(junk as string, { secret: SECRET })).toBeNull();
    }
  });
  it("rejects an unknown role even with a valid signature", async () => {
    const t = await signSession({ ...base, role: "admin" as never }, { secret: SECRET });
    expect(await verifySession(t, { secret: SECRET })).toBeNull();
  });
  it("production refuses to run without a strong SESSION_SECRET", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow();
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" })).toThrow();
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET })).toBe(SECRET);
    expect(getSessionSecret({ NODE_ENV: "development" })).toBeTruthy();
  });
});
