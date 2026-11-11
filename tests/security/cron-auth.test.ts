import { describe, it, expect } from "vitest";
import { verifyCronSecret } from "@/lib/auth/cron";

const req = (h: Record<string, string>) => ({ headers: new Headers(h) });
const SECRET = "a-sufficiently-long-secret-value";

describe("cron authentication fails closed", () => {
  it("refuses everything when no secret is configured (there is no default)", async () => {
    for (const s of [undefined, "", "short"]) {
      const r = verifyCronSecret(req({ authorization: "Bearer dev-cron-secret" }), s);
      expect(r?.status).toBe(503);
    }
  });
  it("rejects missing or wrong tokens, accepts the right one in either header", async () => {
    expect(verifyCronSecret(req({}), SECRET)?.status).toBe(401);
    expect(verifyCronSecret(req({ authorization: "Bearer nope" }), SECRET)?.status).toBe(401);
    expect(verifyCronSecret(req({ authorization: `Bearer ${SECRET}` }), SECRET)).toBeNull();
    expect(verifyCronSecret(req({ "x-cron-secret": SECRET }), SECRET)).toBeNull();
  });
  it("the well-known example secrets are not accepted", async () => {
    for (const bad of ["dev-cron-secret", "dev-cron-secret-12345"]) {
      expect(verifyCronSecret(req({ authorization: `Bearer ${bad}` }), SECRET)?.status).toBe(401);
    }
  });
});
