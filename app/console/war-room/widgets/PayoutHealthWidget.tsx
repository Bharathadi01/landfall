"use client";

import React from "react";

export interface PayoutItemRow {
  batchId: string;
  itemId: string;
  /** Internal reference only (never a recipient address). */
  senderItemRef: string;
  amountUsd: string;
  status: "SUCCESS" | "UNCLAIMED" | "RETURNED" | "FAILED" | "PENDING";
  txId?: string;
}

/**
 * A SNAPSHOT of what PayPal's Sandbox returned for batch VTJG3SR5BY56C (GET /v1/payments/payouts/{id},
 * 2026-11-11): batch_status SUCCESS, $500.00, five $100 items, ONE credited and FOUR unclaimed.
 * It is static evidence, not a live feed; the live path is POST /api/payouts/refresh → GET /api/payouts.
 * Recipient addresses are deliberately not part of this data.
 */
const CAPTURED_BATCH = "VTJG3SR5BY56C";
const CAPTURED_AT = "2026-11-11";

export function PayoutHealthWidget({
  items = [
    { batchId: CAPTURED_BATCH, itemId: "WMPFRHQ3EY2QQ", senderItemRef: "hh_tbw_001", amountUsd: "$100.00", status: "SUCCESS", txId: "7UY263785W054201W" },
    { batchId: CAPTURED_BATCH, itemId: "FTM6GK53DC4RQ", senderItemRef: "hh_tbw_002", amountUsd: "$100.00", status: "UNCLAIMED", txId: "75T85158X6122100W" },
    { batchId: CAPTURED_BATCH, itemId: "9LHJK5CHQ28L2", senderItemRef: "hh_tbw_003", amountUsd: "$100.00", status: "UNCLAIMED", txId: "7CB07045KK2710414" },
    { batchId: CAPTURED_BATCH, itemId: "HUVCNGQV67X3A", senderItemRef: "hh_tbw_004", amountUsd: "$100.00", status: "UNCLAIMED", txId: "4R824497CF5483216" },
    { batchId: CAPTURED_BATCH, itemId: "CJHE7X4UEA65S", senderItemRef: "hh_tbw_005", amountUsd: "$100.00", status: "UNCLAIMED", txId: "7P739657VA043154A" },
  ],
}: {
  items?: PayoutItemRow[];
}) {
  const successCount = items.filter((i) => i.status === "SUCCESS").length;
  const unclaimedCount = items.filter((i) => i.status === "UNCLAIMED").length;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-ink/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-delivered0" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Real PayPal Sandbox batch · batch status SUCCESS
          </h3>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-delivered0/20 text-delivered border border-delivered0/30">
            {successCount} of {items.length} credited
          </span>
          {unclaimedCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber0/20 text-amber border border-amber0/30">
              {unclaimedCount} UNCLAIMED
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 text-[11px] font-mono text-ink-3">
        Batch <span className="text-paypal">{items[0]?.batchId}</span>
      </div>

      <ul className="mt-2 divide-y divide-line/60">
        {items.map((it) => (
          <li key={it.itemId} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-ink">{it.itemId}</span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  it.status === "SUCCESS"
                    ? "bg-delivered0/20 text-delivered border border-delivered0/40"
                    : "bg-amber0/20 text-amber border border-amber0/40"
                }`}
              >
                {it.status}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-ink-2">
              <span className="truncate">
                {it.senderItemRef} · tx {it.txId || "—"}
              </span>
              <span className="shrink-0 font-bold text-delivered">{it.amountUsd}</span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-ink-3">
        Snapshot captured from PayPal on {CAPTURED_AT}. The batch is SUCCESS, but only {successCount} of {items.length} items were credited; the rest are unclaimed
        and return to the sender if not claimed within 30 days. SUCCESS means credited to a PayPal account, not that the household received or used it.
      </p>
    </div>
  );
}
