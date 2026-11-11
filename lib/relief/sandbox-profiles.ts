import { studioPayoutItems } from "@/lib/studio/landfall-studio-data";

/**
 * Display profiles for the SYNTHETIC people behind real PayPal Sandbox payments. Money and status always come
 * from stored PayPal records; only the fictional name / zone / priority tier come from here, and the UI labels them
 * "Sandbox test profile". Households hh_tbw_001..005 reuse the replay roster so a person is the same person in both modes.
 */
export interface SandboxProfile {
  householdRef: string;
  resident: string;
  zone: string;
  tier: number;
  tierLabel: string;
  wallet: "PAYPAL" | "VENMO";
  language: "en" | "es" | "ht" | "vi" | "zh";
}

const fromReplay = new Map(
  studioPayoutItems.map((i) => [
    i.household_ref,
    { householdRef: i.household_ref, resident: i.resident_name, zone: i.zone, tier: i.tier_number, tierLabel: i.priority_tier, wallet: i.recipient_wallet, language: "en" as const },
  ])
);

const EXTRA: SandboxProfile[] = [
  { householdRef: "hh_live_001", resident: "Sandbox recipient A", zone: "Zone A · Sandbox test", tier: 3, tierLabel: "Tier 3 · Sandbox test profile", wallet: "PAYPAL", language: "en" },
  { householdRef: "hh_live_002", resident: "Sandbox recipient B", zone: "Zone B · Sandbox test", tier: 3, tierLabel: "Tier 3 · Sandbox test profile", wallet: "PAYPAL", language: "es" },
];

export function profileFor(householdRef: string): SandboxProfile {
  const hit = fromReplay.get(householdRef) ?? EXTRA.find((p) => p.householdRef === householdRef);
  if (hit) return hit;
  return { householdRef, resident: `Household ${householdRef}`, zone: "Sandbox test", tier: 0, tierLabel: "Sandbox test profile", wallet: "PAYPAL", language: "en" };
}
