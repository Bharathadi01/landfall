/**
 * Import an EXISTING PayPal Sandbox batch into Landfall's records + ledger (read-only toward PayPal: GET batch, GET balance).
 *
 *   pnpm exec tsx scripts/import-sandbox-batch.ts VTJG3SR5BY56C            # dry run: prints what it would record
 *   pnpm exec tsx scripts/import-sandbox-batch.ts VTJG3SR5BY56C --apply    # writes to the database in DATABASE_URL
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { getPayoutBatch } from "../lib/paypal/payout-reads";
import { getAccountBalances } from "../lib/paypal/reporting";
import { openingJournal } from "../lib/payouts/opening";
import { toCents } from "../lib/payouts/status";

async function main() {
  const id = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!id || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    console.error("Usage: import-sandbox-batch.ts <PAYPAL_BATCH_ID> [--apply]");
    process.exit(2);
  }
  if (process.env.PAYPAL_ENV === "live") {
    console.error("Refusing to run against PayPal LIVE.");
    process.exit(2);
  }
  const host = (process.env.DATABASE_URL ?? "").replace(/^[a-z]+:\/\/[^@]*@/, "").replace(/\/.*/, "");
  if (!apply) {
    const { data } = await getPayoutBatch(id, "batch_import_dry_run", { page: 1, pageSize: 100, totalRequired: true });
    const bal = await getAccountBalances("batch_import_dry_run");
    const items = (data.items ?? []).map((i) => ({ status: i.transaction_status, amountCents: toCents(i.payout_item?.amount.value) ?? 0, feeCents: toCents(i.payout_item_fee?.value) }));
    const j = openingJournal({ paypalAvailableCents: Math.round(bal.availableUsd * 100), items });
    console.log(`DRY RUN (database host: ${host || "unset"})`);
    console.log(`Batch ${id}: ${data.batch_header.batch_status}, ${items.length} items`);
    for (const i of data.items ?? []) console.log(`  ${i.payout_item_id}  ${i.transaction_status}  ${i.payout_item?.amount.value} ${i.payout_item?.amount.currency}  tx=${i.transaction_id ?? "-"}`);
    console.log("Opening positions (cents):", j.positions);
    console.log("Re-run with --apply to write.");
    return;
  }
  const { importExistingBatch } = await import("../lib/payouts/import");
  const out = await importExistingBatch(id, { getAvailableUsd: async () => (await getAccountBalances("batch_import")).availableUsd });
  console.log(JSON.stringify(out, null, 2));
}
main().then(() => process.exit(0)).catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
