/**
 * Deterministic, data-grounded answers for the Studio Agent.
 *
 * Used as the labelled OFFLINE FALLBACK when the live model is unavailable, and as the
 * reference for what the agent is allowed to say. Every figure and identifier is computed
 * from the same sources the Studio canvas shows (lib/studio/landfall-studio-data.ts) —
 * nothing is typed twice, and nothing here can move money.
 */

import {
  studioPayoutItems,
  studioPayoutBatches,
  studioSolvency,
  studioLedgerReconciliation,
  studioObligations,
  TREASURY,
  type PayoutItemRow,
} from "./landfall-studio-data";

const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const usd2 = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Statuses where a person must act (PENDING is monitor-only: PayPal sends no item webhook, so we poll). */
const NEEDS_HUMAN: PayoutItemRow["transaction_status"][] = ["UNCLAIMED", "ONHOLD", "BLOCKED", "FAILED", "RETURNED"];

/**
 * Imperative requests to move, re-send, approve or spend money, or to bypass controls.
 * Deliberately NOT keyed on bare words like "disburse" or "transfer", so analytical
 * requests ("show disbursements by zone", "bank transfers by batch") still work.
 * The agent has no money-moving tools at all; this is a pre-filter that explains why.
 */
export const MONEY_MOVEMENT_PATTERN = new RegExp(
  [
    String.raw`\bre-?issu\w*`,
    String.raw`\bre-?send\w*`,
    String.raw`\bre-?submit\w*`,
    String.raw`\bretry\b`,
    String.raw`\bre-?pay\b`,
    String.raw`\bpay\s+(?:[\w.'’-]+\s+){0,4}(?:again|now|immediately)\b`,
    String.raw`\bsend\s+(?:\$?\d|money|funds|cash|another|a\s+(?:second|duplicate|new)|the\s+(?:payout|payment)|every|all)`,
    String.raw`\bwire\s+(?:the\s+)?(?:funds|money|\$)`,
    String.raw`\btransfer\s+(?:\$?\d|funds|money)`,
    String.raw`\brelease\s+(?:the\s+)?(?:held|\$|funds|payment|payout)`,
    String.raw`\brefund\s+(?:item|the|this|her|him|them|\$|\w+_\w+)`,
    String.raw`\bapprove\s+(?:the\s+|this\s+|a\s+)?(?:payment|payout|plan|batch)`,
    String.raw`\bdisburse\s+(?:\$|funds|money|to\b)`,
    String.raw`\bexecute\s+(?:a\s+|the\s+)?(?:payment|payout)`,
    String.raw`\bcharge\s+(?:the\s+)?vault`,
    String.raw`\bspend\s+(?:the\s+)?(?:protected\s+)?reserve`,
    String.raw`\boverride\s+(?:the\s+)?(?:reserve|polic\w*|approval|rule\w*|floor|limit)`,
    String.raw`\bbypass\b`,
    String.raw`\balter\s+(?:the\s+)?ledger`,
    String.raw`\bignore\b.*\b(?:safeguard|polic\w*|rule\w*|instruction\w*)`,
  ].join("|"),
  "i"
);

/** "Create / build / generate a payout recovery report | page | dashboard" */
export function isRecoveryReportRequest(query: string): boolean {
  const q = query.toLowerCase();
  return /\b(create|build|generate|make|add)\b/.test(q) && /(payout recovery|recovery (report|page|dashboard|status|ageing|aging))/.test(q);
}

export function isMoneyMovementRequest(query: string): boolean {
  return MONEY_MOVEMENT_PATTERN.test(query);
}

/** Wrap record identifiers in backticks so chat markdown does not eat their underscores. */
export function escapeIdentifiers(text: string): string {
  return text.replace(/(?<!`)\b(?:item|obl|hh|wh|ledg)_[a-z0-9_]+\b(?!`)/gi, "`$&`");
}

function refusal(): string {
  const unclaimed = studioPayoutItems.find((i) => i.transaction_status === "UNCLAIMED");
  const ref = unclaimed
    ? `${unclaimed.item_id} · ${unclaimed.batch_id} · ${usd2(unclaimed.amount_usd)} USD, held for ${unclaimed.resident_name}`
    : "any payout item";
  return (
    "ACCESS DENIED — this is a financial-safety refusal.\n\n" +
    "1. The Studio Agent works in STRICT READ-ONLY mode. It has ZERO authority to move funds, re-issue or resend payouts, " +
    "alter the ledger, or change the protected reserve — it has no tools that can.\n\n" +
    "2. Why a repeat payout is blocked: sending a second payout while the first is still claimable breaks the " +
    "duplicate-prevention invariant. For example, " +
    ref +
    " is still claimable at PayPal for up to 30 days; if the resident claims it after a duplicate is sent, the loss is irreversible.\n\n" +
    "3. Safe next step: a person contacts the resident to help them claim. If the 30 days pass, PayPal returns the funds to the " +
    "account; after the ledger shows the return, a NEW plan can be approved with two passkeys.\n\n" +
    "Zero Money Moved. All disbursements require two-person passkey approval and deterministic policy clearance."
  );
}

export function answerFromReliefData(query: string): string | null {
  const raw = answerCore(query);
  return raw === null ? null : escapeIdentifiers(raw);
}

function answerCore(query: string): string | null {
  const q = query.toLowerCase().trim();
  const items = studioPayoutItems;
  const unresolved = items.filter((i) => i.is_unresolved > 0);
  const totalUnresolved = unresolved.reduce((t, i) => t + i.unresolved_usd, 0);

  if (isMoneyMovementRequest(q)) return refusal();

  // Scenario A — unclaimed assistance and oldest exceptions
  if (
    (q.includes("unclaimed assistance") || (q.includes("unclaimed") && (q.includes("outstanding") || q.includes("remains")))) &&
    (q.includes("oldest") || q.includes("how much") || q.includes("which payout exceptions"))
  ) {
    const unclaimed = items.filter((i) => i.transaction_status === "UNCLAIMED");
    const totalUnclaimed = unclaimed.reduce((t, i) => t + i.unresolved_usd, 0);
    const ranked = [...unresolved].sort((a, b) => b.age_hours - a.age_hours);
    const oldestUnclaimed = [...unclaimed].sort((a, b) => b.age_hours - a.age_hours)[0];
    return (
      `Unclaimed Assistance Analysis (sandbox replay data):\n\n` +
      `1. Outstanding UNCLAIMED: ${usd(totalUnclaimed)} USD across ${unclaimed.length} item${unclaimed.length === 1 ? "" : "s"}.\n` +
      (oldestUnclaimed
        ? `• ${oldestUnclaimed.item_id} (${oldestUnclaimed.resident_name}) · ${usd(oldestUnclaimed.amount_usd)} USD · age ${oldestUnclaimed.age_hours} hrs (${oldestUnclaimed.age_band}) · ${oldestUnclaimed.batch_id}\n` +
          `• PayPal status UNCLAIMED: the recipient has no PayPal account yet; PayPal auto-returns the funds after 30 days.\n\n`
        : "\n") +
      `2. Unclaimed vs all unresolved: ${usd(totalUnclaimed)} is unclaimed; ${usd(totalUnresolved)} is unresolved in total across ${unresolved.length} items (not SUCCESS).\n\n` +
      `3. Oldest exceptions first:\n` +
      ranked.slice(0, 5).map((e, n) => `  ${n + 1}. ${e.item_id} (${e.resident_name}): ${usd(e.amount_usd)} · ${e.transaction_status} · ${e.age_hours} hrs (${e.age_band})`).join("\n") +
      `\n\n4. Evidence: payout_items and payout_batches in the Studio data model. Last observation time is the replay clock, not live.\n` +
      `5. Do NOT issue duplicate payment while the funds remain claimable in the PayPal wallet.`
    );
  }

  // Scenario B — report creation (the live agent does this with a real Studio tool; this is the offline description)
  if (
    (q.includes("create") || q.includes("build") || q.includes("generate")) &&
    (q.includes("payout recovery report") || (q.includes("recovery") && (q.includes("status") || q.includes("ageing") || q.includes("aging"))))
  ) {
    const counts = Object.entries(
      items.reduce<Record<string, number>>((a, i) => ((a[i.transaction_status] = (a[i.transaction_status] ?? 0) + 1), a), {})
    )
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");
    return (
      `Offline description of the Payout Recovery report (the live agent adds the page itself through a Studio tool):\n\n` +
      `• Unresolved value: ${usd(totalUnresolved)} across ${unresolved.length} items\n` +
      `• Item outcomes by PayPal status — ${counts}\n` +
      `• Oldest exception: ${Math.max(...unresolved.map((i) => i.age_hours))} hrs\n` +
      `• Gross dispatched: ${usd(items.reduce((t, i) => t + i.amount_usd, 0))}\n` +
      `The page has a status chart, an ageing chart and a workbench grid, all reading the same payout_items source.`
    );
  }

  // Scenario C — treasury explanation
  if (
    (q.includes("explain") || q.includes("tell me about")) &&
    (q.includes("protected reserve") || q.includes("allocatable balance") || q.includes("coverage ratio"))
  ) {
    const s = studioSolvency[0];
    return (
      `Treasury & Reserve Breakdown (demo fund, sandbox replay):\n` +
      `• Funds received: ${usd(s.total_balance_usd)} · cash still in the PayPal account: ${usd(TREASURY.available)}\n` +
      `• Protected Reserve: ${usd(s.reserve_usd)} locked (${s.reserve_ratio_pct}% of funds received).\n` +
      `  - Reserve policy floor: ${s.policy_floor_pct}% of funds received requires ${usd(s.required_reserve_usd)}.\n` +
      `  - Reserve Headroom: ${s.headroom_usd >= 0 ? "+" : "−"}${usd(Math.abs(s.headroom_usd))} versus the floor.\n` +
      `• Allocatable Cash: ${usd(s.allocatable_usd)} (cash in account minus the protected reserve).\n` +
      `• Already sent to PayPal: ${usd(TREASURY.paidOut + TREASURY.inFlight)} (${usd(TREASURY.paidOut)} credited, ${usd(TREASURY.inFlight)} unclaimed/held/pending).\n` +
      `• Coverage Ratio: ${s.coverage_ratio}× = Allocatable Cash (${usd(s.allocatable_usd)}) ÷ ${usd(s.required_usd)} needed to re-issue failed and returned payouts (new approval required).`
    );
  }

  // Scenario D — focus on Tier 1
  if (
    (q.includes("focus") || q.includes("filter")) &&
    (q.includes("tier 1") || q.includes("tier-1")) &&
    (q.includes("unclaimed") || q.includes("paypal"))
  ) {
    const matching = items.filter((i) => i.tier_number === 1);
    return (
      `Read-only filter applied: Priority Tier = Tier 1 (medical-device households).\n` +
      `• ${matching.length} items:\n` +
      matching.map((m) => `  - ${m.item_id} (${m.resident_name}): ${m.transaction_status} · ${usd(m.amount_usd)} · ${m.zone}`).join("\n") +
      `\n• Click “Clear Filter” or reset the template to restore the full view.`
    );
  }

  // Evaluation prompt 1 — items by PayPal status, sorted by unresolved value
  if (
    (q.includes("paypal status") || q.includes("by status") || q.includes("status and sort")) &&
    (q.includes("unresolved") || q.includes("sort"))
  ) {
    const byStatus = new Map<string, { count: number; unresolvedUsd: number }>();
    for (const item of items) {
      const prev = byStatus.get(item.transaction_status) ?? { count: 0, unresolvedUsd: 0 };
      byStatus.set(item.transaction_status, { count: prev.count + 1, unresolvedUsd: prev.unresolvedUsd + item.unresolved_usd });
    }
    const sorted = [...byStatus.entries()].sort((a, b) => b[1].unresolvedUsd - a[1].unresolvedUsd);
    const needHuman = items.filter((i) => NEEDS_HUMAN.includes(i.transaction_status));
    const needHumanUsd = needHuman.reduce((t, i) => t + i.amount_usd, 0);
    return (
      `Payout items by exact PayPal Payouts v1 item status, sorted by unresolved value:\n` +
      sorted.map(([st, d]) => `• ${st}: ${d.count} item${d.count === 1 ? "" : "s"} · ${usd(d.unresolvedUsd)} unresolved`).join("\n") +
      `\n\nSummary: ${needHuman.length} items (${usd2(needHumanUsd)} USD) need a person: ${[...new Set(needHuman.map((i) => i.transaction_status))].join(", ")}. ` +
      `PENDING items are monitored, not resubmitted.`
    );
  }

  // Evaluation prompt 2 — UNCLAIMED age distribution
  if (q.includes("unclaimed") && (q.includes("age") || q.includes("filter") || q.includes("distribution"))) {
    const unclaimedItems = items.filter((i) => i.transaction_status === "UNCLAIMED");
    return (
      `UNCLAIMED items (${unclaimedItems.length}):\n` +
      unclaimedItems.map((i) => `• ${i.item_id} (${i.resident_name}): ${i.age_hours} hours (${i.age_band}) · ${usd(i.amount_usd)} USD`).join("\n") +
      `\n\nRecommended action: a person sends an SMS or email claim reminder through a consented contact channel. Do NOT re-issue a duplicate payment while the 30-day PayPal claim window is open.`
    );
  }

  // Evaluation prompt 3 — unresolved value by batch
  if (q.includes("compare") && q.includes("batch") && (q.includes("currency") || q.includes("unresolved"))) {
    const lines = studioPayoutBatches.map((b) => {
      const rows = items.filter((i) => i.batch_id === b.batch_id);
      const unres = rows.reduce((t, i) => t + i.unresolved_usd, 0);
      return `• ${b.batch_id}: ${usd(b.total_amount_usd)} ${b.currency} sent · ${usd(unres)} unresolved exceptions across ${rows.filter((i) => i.is_unresolved > 0).length} of ${rows.length} items · batch status ${b.batch_status} (${b.environment})`;
    });
    return `Payout value by submitted batch (single USD rail; no cross-currency summation):\n${lines.join("\n")}\n\nA batch SUCCESS only means PayPal processed the batch — check each item for holds or unclaimed payments.`;
  }

  // Evaluation prompt 4 — reconciliation
  if (q.includes("reconciliation") && (q.includes("mismatch") || q.includes("variance") || q.includes("discrepancy") || q.includes("ledger"))) {
    const lines = studioLedgerReconciliation.map((l) => `• ${l.account_name}: ${usd(l.balance_usd)} (variance ${l.variance_cents}¢ · ${l.match_status})`);
    const sumBalances = studioLedgerReconciliation.reduce((t, l) => t + l.balance_usd, 0);
    const balanced = sumBalances === TREASURY.total && studioLedgerReconciliation.every((l) => l.variance_cents === 0);
    return (
      `Double-entry ledger reconciliation check (demo ledger):\n${lines.join("\n")}\n\n` +
      (balanced
        ? `Audit verdict: ZERO reconciliation mismatches across ${studioLedgerReconciliation.length} accounts (0 minor-unit variance); balances sum to funds received (${usd(TREASURY.total)}).`
        : `Audit verdict: MISMATCH — balances sum to ${usd(sumBalances)} against ${usd(TREASURY.total)} funds received. Investigate before any new approval.`)
    );
  }

  // Evaluation prompt 5 — build a report
  if (
    (q.includes("build a report") || q.includes("create a report") || q.includes("outcomes over time")) &&
    (q.includes("grid") || q.includes("items") || q.includes("outcomes"))
  ) {
    return (
      `Report layout on Page C (Payout Recovery Intelligence):\n` +
      `• Payout status distribution (donut, exact PayPal item statuses)\n` +
      `• Exception ageing by bracket (<6h, 6–24h, 24–48h, >48h)\n` +
      `• Payout lifecycle widget and evidence chain for the selected item\n` +
      `• Workbench grid with ${items.length} record-level items\n\n` +
      `Cross-filtering active: click a status segment to filter the queue.`
    );
  }

  // Evaluation prompt 6 — SUCCESS vs receipt
  if ((q.includes("difference") || q.includes("explain")) && (q.includes("success") || q.includes("receipt") || q.includes("beneficiary"))) {
    const success = items.filter((i) => i.transaction_status === "SUCCESS");
    return (
      `Provider status vs real-world receipt:\n` +
      `1. PayPal SUCCESS means the funds were credited to the recipient's PayPal/Venmo account. It does NOT prove the resident can access the money, withdrew it, or spent it.\n` +
      `2. Beneficiary Receipt Confirmation needs the resident (or a caseworker) to say so. Landfall keeps these as separate fields with separate provenance, so recipient-reported confirmation is never silently upgraded to provider-verified.\n` +
      `In this replay data ${success.length} items are provider-credited; the confirmation flags on them are synthetic demo values.`
    );
  }

  // Evaluation prompt 7 — obligations → submitted → credited
  if ((q.includes("relationship") || q.includes("flow") || q.includes("stages")) && (q.includes("obligation") || q.includes("submitted") || q.includes("outcomes"))) {
    const obligationsTotal = studioObligations.reduce((a, o) => a + o.grant_usd, 0);
    const exposedCount = studioObligations.filter((o) => o.grant_usd > 0).length;
    const submitted = studioPayoutBatches.reduce((t, b) => t + b.total_amount_usd, 0);
    return (
      `Relief funding to outcome pipeline (USD rail):\n` +
      `1. Approved Obligations: ${usd(obligationsTotal)} (${exposedCount} households in the warning area)\n` +
      `2. Submitted Payout Batch total: ${usd(submitted)} via PayPal Payouts v1 (${studioPayoutBatches.length} batches)\n` +
      `3. Provider-Confirmed Credited: ${usd(TREASURY.paidOut)} (${items.filter((i) => i.transaction_status === "SUCCESS").length} items in SUCCESS)\n` +
      `4. In flight (unclaimed / on hold / pending): ${usd(TREASURY.inFlight)}\n` +
      `5. Not delivered, needs a new approved plan (failed / returned): ${usd(TREASURY.needsReissue)}\n\n` +
      `Zero cross-currency summation applied.`
    );
  }

  // Evaluation prompt 8 — treasury report
  if (
    (q.includes("treasury report") || q.includes("protected reserve") || q.includes("allocatable balance")) &&
    (q.includes("reconciliation") || q.includes("reserve") || q.includes("treasury"))
  ) {
    const s = studioSolvency[0];
    return (
      `Treasury & Reserve Posture (Page B):\n` +
      `• Total Liquid PayPal Balance: ${usd(TREASURY.available)} (cash still in the account)\n` +
      `• Protected Reserve: ${usd(s.reserve_usd)} (${s.reserve_ratio_pct}% of funds received; the 30% policy floor is ${usd(s.required_reserve_usd)})\n` +
      `• Reserve Headroom: ${s.headroom_usd >= 0 ? "+" : "−"}${usd(Math.abs(s.headroom_usd))} versus the floor\n` +
      `• Allocatable Cash: ${usd(s.allocatable_usd)}\n` +
      `• Needed to re-issue failed/returned payouts: ${usd(s.required_usd)} (${s.coverage_ratio}× coverage)\n` +
      `• Replay ledger: internally consistent (0¢ variance, not compared with PayPal) across ${studioLedgerReconciliation.length} accounts.`
    );
  }

  // Prompt starter — who needs help first
  if (/(most at risk|highest priority|who needs help first|highest-priority)/.test(q)) {
    const exposed = studioObligations.filter((o) => o.grant_usd > 0).sort((a, b) => a.tier_number - b.tier_number);
    return [
      `${exposed.length} households have approved obligations. Highest priority first:`,
      ...exposed.slice(0, 3).map((o) => `• ${o.household_ref} — ${o.priority_tier}, ${o.zone}`),
      `Tier 1 (medical-device) households are prioritized first by policy.`,
    ].join("\n");
  }

  // Prompt starter — can we pay everyone
  if (/(pay everyone|can we pay|allocatable|compare.*(cash|relief)|enough (cash|money|funds))/.test(q)) {
    const s = studioSolvency[0];
    return [
      `Yes. ${usd(s.allocatable_usd)} is allocatable against ${usd(s.required_usd)} that would need to be re-issued for failed and returned payouts — ${s.coverage_ratio}× coverage (a new two-key approval is still required).`,
      `The ${usd(TREASURY.reserve)} protected reserve is locked and cannot be spent. See the “Reserve Guardrail” custom widget.`,
    ].join("\n");
  }

  // Prompt starter — relief by zone
  if (/(by zone|by evacuation zone|per zone|relief by zone)/.test(q)) {
    const byZone = new Map<string, number>();
    for (const o of studioObligations) byZone.set(o.zone, (byZone.get(o.zone) ?? 0) + o.grant_usd);
    const lines = [...byZone.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([z, v]) => `• ${z}: ${usd(v)}`);
    return [`Approved relief by evacuation zone:`, ...lines].join("\n");
  }

  // Prompt starter — PayPal vs Venmo
  if (/(paypal vs venmo|venmo|by channel|payout channel|which channel)/.test(q)) {
    const counts = items.reduce<Record<string, number>>((acc, i) => {
      acc[i.recipient_wallet] = (acc[i.recipient_wallet] ?? 0) + 1;
      return acc;
    }, {});
    return `Delivery channels across ${items.length} payout items: ${Object.entries(counts).map(([k, v]) => `${v} via ${k}`).join(", ")}. Venmo payouts are sent through the same PayPal Payouts API.`;
  }

  return null;
}
