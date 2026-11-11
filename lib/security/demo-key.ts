import { getSessionSecret, hmacSha256 } from "@/lib/auth/session";

/**
 * DEMO APPROVAL KEY — the labelled fallback for devices without a passkey authenticator.
 *
 * It is a PIN, shown on the judge test card, that a signed-in persona enters. The server checks it and records the
 * approval with method DEMO_KEY (always displayed as "demo key", never as a passkey). The recorded "signature" is an
 * HMAC over the persona and the exact payload hash, so it cannot be replayed on a different proposal.
 */
export const DEFAULT_DEMO_PIN = "246810";

export function demoPin(env: Record<string, string | undefined> = process.env): string {
  return env.DEMO_APPROVAL_PIN && env.DEMO_APPROVAL_PIN.length >= 4 ? env.DEMO_APPROVAL_PIN : DEFAULT_DEMO_PIN;
}

/**
 * The demo PIN is public (it is printed on the judge card and defaulted in the repo), so it must never be able to authorise
 * movement of real money: it is refused whenever PayPal is configured for LIVE, whatever DEMO_KEY_DISABLED says.
 * Live deployments approve with passkeys only.
 */
export function demoKeyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_KEY_DISABLED !== "true" && env.PAYPAL_ENV !== "live";
}

export async function demoKeySignature(personaId: string, payloadHash: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  const mac = await hmacSha256(getSessionSecret(env), `demo-approval:${personaId}:${payloadHash}`);
  return Buffer.from(mac).toString("hex");
}

export function pinMatches(given: string, env: Record<string, string | undefined> = process.env): boolean {
  const expected = demoPin(env);
  const g = String(given ?? "");
  let diff = expected.length ^ g.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (g.charCodeAt(i) || 0);
  return diff === 0;
}
