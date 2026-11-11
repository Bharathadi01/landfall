/** Display masking for personal data returned by operator APIs. Full values are never needed to follow up on a case. */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [user, domain] = String(email).split("@");
  if (!domain) return "••••";
  const d = domain.split(".");
  return `${user.slice(0, 1)}•••@${d[0].slice(0, 1)}•••.${d.slice(1).join(".") || "•••"}`;
}

/** Email, phone number or PayPal id → a safe hint ("PayPal email d•••@g•••.com", "phone ••••0142"). */
export function maskReceiver(value: string | null | undefined): string {
  if (!value) return "";
  const v = String(value).trim();
  if (v.includes("@")) return maskEmail(v);
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 7) return `••••${digits.slice(-4)}`;
  return `${v.slice(0, 2)}•••${v.slice(-2)}`;
}

/** ~1.1 km precision: enough for a map cluster, not enough to find a house. */
export function roundCoord(n: number | null | undefined, places = 2): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
