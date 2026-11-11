/**
 * WebAuthn (passkeys) — server-side registration and APPROVAL verification.
 *
 * An approval is a passkey assertion over a single-use challenge that is BOUND to the exact payload hash being
 * approved. The server verifies the signature against the stored public key, the origin and the relying-party id,
 * and bumps the signature counter. Nothing the browser says about "who signed" is trusted: the persona comes from
 * the signed session, the key from the database.
 */
import { and, eq, isNull, gt } from "drizzle-orm";
import crypto from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db/client";
import { passkeyCredentials, webauthnChallenges } from "@/lib/db/schema";

const RP_NAME = "Landfall";
const CHALLENGE_TTL_MS = 5 * 60_000;

export interface RpConfig {
  rpID: string;
  origin: string;
  requireUserVerification: boolean;
}

export function rpConfig(env: Record<string, string | undefined> = process.env): RpConfig {
  return {
    rpID: env.WEBAUTHN_RP_ID || "localhost",
    origin: env.WEBAUTHN_ORIGIN || "http://localhost:3000",
    requireUserVerification: env.WEBAUTHN_REQUIRE_UV !== "false",
  };
}

const b64url = (buf: Uint8Array) => Buffer.from(buf).toString("base64url");
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

async function storeChallenge(challenge: string, subject: string, purpose: "register" | "approve", bindHash?: string) {
  await db.insert(webauthnChallenges).values({ challenge, subject, purpose, bindHash: bindHash ?? null, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) });
}

/** Single use: consumed atomically, only for the same person, purpose and payload, and only before it expires. */
export async function consumeChallenge(challenge: string, subject: string, purpose: "register" | "approve", bindHash?: string): Promise<boolean> {
  const rows = await db
    .update(webauthnChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(webauthnChallenges.challenge, challenge),
        eq(webauthnChallenges.subject, subject),
        eq(webauthnChallenges.purpose, purpose),
        isNull(webauthnChallenges.usedAt),
        gt(webauthnChallenges.expiresAt, new Date()),
        bindHash ? eq(webauthnChallenges.bindHash, bindHash) : isNull(webauthnChallenges.bindHash)
      )
    )
    .returning({ c: webauthnChallenges.challenge });
  return rows.length === 1;
}

export async function personaPasskeys(personaId: string) {
  return db.select().from(passkeyCredentials).where(eq(passkeyCredentials.userId, personaId));
}

export async function personaHasPasskey(personaId: string): Promise<boolean> {
  return (await personaPasskeys(personaId)).length > 0;
}

/* ───────────── registration ───────────── */

export async function beginRegistration(personaId: string, personaName: string, env?: Record<string, string | undefined>) {
  const cfg = rpConfig(env);
  const existing = await personaPasskeys(personaId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: cfg.rpID,
    userName: personaName,
    userID: crypto.createHash("sha256").update(personaId).digest(),
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: cfg.requireUserVerification ? "required" : "preferred" },
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: (c.transports ?? undefined) as never })),
  });
  await storeChallenge(options.challenge, personaId, "register");
  return options;
}

export async function finishRegistration(
  personaId: string,
  personaName: string,
  role: "coordinator" | "finance" | "viewer",
  response: RegistrationResponseJSON,
  env?: Record<string, string | undefined>
): Promise<{ ok: true; credentialId: string } | { ok: false; reason: string }> {
  const cfg = rpConfig(env);
  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) => consumeChallenge(challenge, personaId, "register"),
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: cfg.requireUserVerification,
    });
    if (!verification.verified || !verification.registrationInfo) return { ok: false, reason: "Registration could not be verified." };
    const c = verification.registrationInfo.credential;
    await db
      .insert(passkeyCredentials)
      .values({ id: c.id, userId: personaId, userName: personaName, userRole: role === "viewer" ? "volunteer" : role, publicKey: b64url(c.publicKey), counter: c.counter, transports: (c.transports as string[] | undefined) ?? null })
      .onConflictDoNothing();
    return { ok: true, credentialId: c.id };
  } catch {
    return { ok: false, reason: "Registration could not be verified." };
  }
}

/* ───────────── approval ───────────── */

export async function beginApproval(personaId: string, payloadHash: string, env?: Record<string, string | undefined>) {
  const cfg = rpConfig(env);
  const creds = await personaPasskeys(personaId);
  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    userVerification: cfg.requireUserVerification ? "required" : "preferred",
    allowCredentials: creds.map((c) => ({ id: c.id, transports: (c.transports ?? undefined) as never })),
  });
  await storeChallenge(options.challenge, personaId, "approve", payloadHash);
  return options;
}

export type ApprovalVerification = { ok: true; credentialId: string } | { ok: false; reason: string };

export async function finishApproval(personaId: string, payloadHash: string, response: AuthenticationResponseJSON, env?: Record<string, string | undefined>): Promise<ApprovalVerification> {
  const cfg = rpConfig(env);
  const [cred] = await db.select().from(passkeyCredentials).where(and(eq(passkeyCredentials.id, response.id), eq(passkeyCredentials.userId, personaId))).limit(1);
  if (!cred) return { ok: false, reason: "This passkey is not registered for you." };
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (challenge) => consumeChallenge(challenge, personaId, "approve", payloadHash),
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      credential: { id: cred.id, publicKey: fromB64url(cred.publicKey), counter: cred.counter, transports: (cred.transports ?? undefined) as never },
      requireUserVerification: cfg.requireUserVerification,
    });
    if (!v.verified) return { ok: false, reason: "The passkey signature could not be verified." };
    await db.update(passkeyCredentials).set({ counter: v.authenticationInfo.newCounter }).where(eq(passkeyCredentials.id, cred.id));
    return { ok: true, credentialId: cred.id };
  } catch {
    return { ok: false, reason: "The passkey signature could not be verified." };
  }
}
