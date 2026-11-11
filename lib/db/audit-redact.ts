/**
 * Redaction applied to every audit_events payload BEFORE it is written.
 *
 * Audit rows record PayPal requests and responses. Those contain recipient addresses
 * (payout `receiver`, payer emails, phone numbers). The log must keep ids, statuses, amounts
 * and error details, but never a way to identify or contact a recipient.
 *
 * Pure function: no I/O, never mutates its input.
 */

const EMAIL_PATTERN = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Keys whose value identifies or addresses a person, whatever its format (email, phone, PayPal id). */
const SENSITIVE_KEYS = new Set([
  "receiver",
  "email",
  "email_address",
  "payer_email",
  "recipient_email",
  "donor_email",
  "phone",
  "phone_number",
  "national_number",
]);

export const REDACTED_RECIPIENT = "[redacted-recipient]";
export const REDACTED_EMAIL = "[redacted-email]";

const MAX_DEPTH = 12;

export function redactAuditPayload<T>(value: T, depth = 0): T {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return "[redacted-depth-limit]" as unknown as T;

  if (typeof value === "string") {
    return value.replace(EMAIL_PATTERN, REDACTED_EMAIL) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactAuditPayload(v, depth + 1)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) && v !== null && typeof v !== "object") {
        out[key] = REDACTED_RECIPIENT;
      } else {
        out[key] = redactAuditPayload(v, depth + 1);
      }
    }
    return out as T;
  }
  return value;
}
