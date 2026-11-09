/**
 * Data-grounded answers for the Analytics Studio prompt starters.
 * Pure, read-only computations over the same sources the Studio canvas shows —
 * every number in an answer comes from data, never from a model.
 */
import { studioHouseholds, studioSolvency, TREASURY, GRANT_USD } from "./landfall-studio-data";

const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function answerFromReliefData(query: string): string | null {
  const q = query.toLowerCase();

  if (/(most at risk|highest priority|who needs help first|highest-priority)/.test(q)) {
    const exposed = studioHouseholds
      .filter((h) => h.grant_usd > 0)
      .sort((a, b) => a.priority_tier.localeCompare(b.priority_tier));
    const top = exposed.slice(0, 3).map((h) => `• ${h.household_id} — ${h.tier_label}, ${h.zone}`);
    return [
      `${exposed.length} households are inside the warning area. Highest priority first:`,
      ...top,
      `Tier 1 (medical-device) households are paid first by policy. Use the “Priority tier” filter to focus the board.`,
    ].join("\n");
  }

  if (/(pay everyone|can we pay|allocatable|compare.*(cash|relief)|enough (cash|money|funds))/.test(q)) {
    const s = studioSolvency[0];
    const ratio = s.required_usd > 0 ? s.allocatable_usd / s.required_usd : 0;
    return [
      `Yes. ${usd(s.allocatable_usd)} is available to pay against ${usd(s.required_usd)} owed to exposed households — ${ratio.toFixed(1)}× coverage.`,
      `The ${usd(TREASURY.reserve)} protected reserve is excluded and cannot be spent. See the “Can we pay everyone?” widget.`,
    ].join("\n");
  }

  if (/(by zone|by evacuation zone|per zone|relief by zone)/.test(q)) {
    const byZone = new Map<string, number>();
    for (const h of studioHouseholds) byZone.set(h.zone, (byZone.get(h.zone) ?? 0) + h.grant_usd);
    const lines = [...byZone.entries()].sort((a, b) => b[1] - a[1]).map(([z, v]) => `• ${z}: ${usd(v)}`);
    return [`Relief grants by evacuation zone (${usd(GRANT_USD)} per exposed household):`, ...lines].join("\n");
  }

  if (/(paypal vs venmo|venmo|by channel|payout channel|which channel)/.test(q) && !/transfer|send|pay \$/.test(q)) {
    const counts = studioHouseholds.reduce<Record<string, number>>((acc, h) => {
      acc[h.payout_channel] = (acc[h.payout_channel] ?? 0) + 1;
      return acc;
    }, {});
    return [
      `Delivery channels: ${Object.entries(counts).map(([k, v]) => `${v} via ${k}`).join(", ")}.`,
      `Spanish-speaking households default to Venmo, which runs on PayPal rails.`,
    ].join("\n");
  }

  return null;
}
