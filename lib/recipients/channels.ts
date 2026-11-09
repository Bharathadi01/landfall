/**
 * PAYMENT CHANNEL RESOLUTION & SAFETY (§4.4, §10)
 * Invariants:
 * 1. Payer ID is validated for format (13 alphanumeric chars).
 * 2. Unverified or missing Payer ID falls back to Landfall-verified email.
 * 3. Manual channels (cash card, check) are NEVER dispatched to PayPal Payouts.
 */

import crypto from "crypto";
import type { PaymentChannelType } from "./types";

export interface ChannelResolutionResult {
  paymentChannel: PaymentChannelType;
  receiver: string;
  isVerified: boolean;
  requiresEmailVerification: boolean;
  notes: string;
}

/**
 * Validates PayPal Payer ID format (typically 13 alphanumeric characters, e.g. RMYYMT3FXD8LJ).
 */
export function isValidPayerId(id?: string | null): boolean {
  if (!id) return false;
  return /^[A-Z0-9]{13}$/.test(id.trim());
}

/**
 * Validates email address format.
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Resolves a recipient's payment channel given available credentials.
 */
export function resolvePaymentChannel({
  payerId,
  payerIdVerified = false,
  email,
  emailVerified = false,
  manualPreferred = false,
}: {
  payerId?: string | null;
  payerIdVerified?: boolean;
  email?: string | null;
  emailVerified?: boolean;
  manualPreferred?: boolean;
}): ChannelResolutionResult {
  if (manualPreferred) {
    return {
      paymentChannel: "MANUAL",
      receiver: "OFFLINE_MANUAL_DISBURSEMENT",
      isVerified: true,
      requiresEmailVerification: false,
      notes: "Offline assistance channel (cash card / check) - isolated from PayPal API.",
    };
  }

  // 1. Primary: Verified PayPal Payer ID
  if (payerId && isValidPayerId(payerId) && payerIdVerified) {
    return {
      paymentChannel: "PAYPAL_ID",
      receiver: payerId.trim(),
      isVerified: true,
      requiresEmailVerification: false,
      notes: "Direct PayPal wallet transfer via verified Payer ID.",
    };
  }

  // 2. Secondary / Fallback: Landfall-verified Email
  if (email && isValidEmail(email)) {
    const trimmedEmail = email.trim().toLowerCase();
    if (emailVerified) {
      return {
        paymentChannel: "EMAIL",
        receiver: trimmedEmail,
        isVerified: true,
        requiresEmailVerification: false,
        notes: "Direct PayPal payout via Landfall-verified email address.",
      };
    }

    return {
      paymentChannel: "EMAIL",
      receiver: trimmedEmail,
      isVerified: false,
      requiresEmailVerification: true,
      notes: "Email provided but pending Landfall verification link.",
    };
  }

  // 3. Fallback if Payer ID was provided without verification
  if (payerId && isValidPayerId(payerId) && !payerIdVerified) {
    return {
      paymentChannel: "PAYPAL_ID",
      receiver: payerId.trim(),
      isVerified: false,
      requiresEmailVerification: false,
      notes: "Payer ID provided without OAuth verification.",
    };
  }

  return {
    paymentChannel: "UNSET",
    receiver: "UNSET",
    isVerified: false,
    requiresEmailVerification: false,
    notes: "No valid payment route configured.",
  };
}

/**
 * Checks if a payment channel is eligible for automated PayPal Payouts batches.
 * HARD INVARIANT: MANUAL channels are NEVER sent to PayPal Payouts API.
 */
export function isChannelEligibleForPayPalPayout(channel: PaymentChannelType): boolean {
  return channel === "PAYPAL_ID" || channel === "EMAIL";
}

/**
 * Generates an email verification token with 24-hour expiration.
 */
export function generateEmailVerificationToken(email: string): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return { token, tokenHash, expiresAt };
}

/**
 * Verifies an email verification token against its stored hash and expiration.
 */
export function verifyEmailToken({
  token,
  storedTokenHash,
  expiresAt,
  usedAt,
}: {
  token: string;
  storedTokenHash: string;
  expiresAt: Date | string;
  usedAt?: Date | string | null;
}): { valid: boolean; reason?: string } {
  if (usedAt) {
    return { valid: false, reason: "Verification token has already been used." };
  }

  const expirationDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Date.now() > expirationDate.getTime()) {
    return { valid: false, reason: "Verification token has expired (24h limit)." };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== storedTokenHash) {
    return { valid: false, reason: "Invalid verification token." };
  }

  return { valid: true };
}
