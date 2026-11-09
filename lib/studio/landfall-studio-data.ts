/**
 * Data sources for the AG Studio "Relief Analytics" workspace.
 * Derived from the same fixtures and figures the rest of the console shows,
 * so Studio and the Command Center always agree.
 */
import { SYNTHETIC_HOUSEHOLDS } from "@/lib/fixtures/households";

export const GRANT_USD = 500;
export const TREASURY = {
  available: 14250,
  reserve: 5000,
  feeBuffer: 120,
  allocatable: 9250,
} as const;

export function priorityTierOf(h: (typeof SYNTHETIC_HOUSEHOLDS)[number]): number {
  return h.hasMedicalDevice ? 1 : h.isElderlyLivingAlone ? 2 : h.hasDisability ? 3 : h.hasChildrenUnder5 ? 4 : 5;
}

const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 · Medical device",
  2: "Tier 2 · Elderly alone",
  3: "Tier 3 · Disability",
  4: "Tier 4 · Young children",
  5: "Tier 5 · General",
};

export const studioHouseholds = SYNTHETIC_HOUSEHOLDS.map((h) => {
  const tier = priorityTierOf(h);
  const exposed = h.id !== "hh_orl_006";
  return {
    household_id: h.id,
    zone: h.zone,
    priority_tier: `Tier ${tier}`,
    tier_label: TIER_LABEL[tier],
    exposure: exposed ? "In warning area" : "Outside warning",
    payout_channel: h.language === "es" ? "Venmo" : "PayPal",
    language: h.language.toUpperCase(),
    grant_usd: exposed ? GRANT_USD : 0,
    households: 1,
  };
});

export const studioTreasury = [
  { bucket: "Available to allocate", amount_usd: TREASURY.allocatable, meaning: "Relief cash" },
  { bucket: "Protected reserve", amount_usd: TREASURY.reserve, meaning: "Reserve" },
  { bucket: "PayPal fee buffer", amount_usd: TREASURY.feeBuffer, meaning: "PayPal" },
];

export const studioFunnel = [
  { stage: "Enrolled", households: 6 },
  { stage: "Location verified", households: 6 },
  { stage: "In warning area", households: 5 },
  { stage: "Policy eligible", households: 5 },
  { stage: "Two-key approved", households: 5 },
  { stage: "Paid via PayPal", households: 5 },
];

const exposedCount = studioHouseholds.filter((h) => h.grant_usd > 0).length;

export const studioSolvency = [
  {
    allocatable_usd: TREASURY.allocatable,
    required_usd: exposedCount * GRANT_USD,
    reserve_usd: TREASURY.reserve,
  },
];

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd = (id: string, name: string) => ({ id, name, format: "currencyFormat", formatOptions: { format: USD } });
const txt = (id: string, name: string) => ({ id, name, format: "textFormat" });
const int = (id: string, name: string) => ({ id, name, format: "integerFormat" });

export const studioSources = [
  {
    id: "households",
    name: "Households",
    data: studioHouseholds,
    fields: [
      txt("household_id", "Household"),
      txt("zone", "Evacuation zone"),
      txt("priority_tier", "Priority tier"),
      txt("tier_label", "Priority"),
      txt("exposure", "Storm exposure"),
      txt("payout_channel", "Payout channel"),
      txt("language", "Language"),
      usd("grant_usd", "Relief grant"),
      int("households", "Households"),
    ],
  },
  {
    id: "treasury",
    name: "Treasury",
    data: studioTreasury,
    fields: [txt("bucket", "Bucket"), usd("amount_usd", "Amount"), txt("meaning", "Meaning")],
  },
  {
    id: "funnel",
    name: "Response funnel",
    data: studioFunnel,
    fields: [txt("stage", "Stage"), int("households", "Households")],
  },
  {
    id: "solvency",
    name: "Solvency",
    data: studioSolvency,
    fields: [usd("allocatable_usd", "Available to pay"), usd("required_usd", "Owed to households"), usd("reserve_usd", "Protected reserve")],
  },
];

export const STUDIO_PROMPT_STARTERS = [
  { label: "Who is most at risk?", prompt: "Which households in the warning area have the highest priority tier?" },
  { label: "Can we pay everyone?", prompt: "Compare allocatable cash against the relief required for exposed households." },
  { label: "Relief by zone", prompt: "Chart total relief grants by evacuation zone." },
  { label: "PayPal vs Venmo", prompt: "Break down households by payout channel." },
];
