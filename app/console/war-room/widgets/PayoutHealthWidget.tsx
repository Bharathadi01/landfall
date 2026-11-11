"use client";

import React from "react";

export interface PayoutItemRow {
  batchId: string;
  itemId: string;
  receiver: string;
  amountUsd: string;
  status: "SUCCESS" | "UNCLAIMED" | "RETURNED" | "FAILED" | "PENDING";
  txId?: string;
}

export function PayoutHealthWidget({
  items = [
    {
      batchId: "CYX4HC52K54WN",
      itemId: "XVV68QXJWJ66Y",
      receiver: "sb-tv43cm53751698@personal.example.com",
      amountUsd: "$1.00",
      status: "SUCCESS",
      txId: "6SM40781T11720216",
    },
    {
      batchId: "7Y5GP4ETNLCUQ",
      itemId: "FR7DHMX8QE59A",
      receiver: "sb-h4335437482811@personal.example.com",
      amountUsd: "$1.00",
      status: "SUCCESS",
      txId: "28T57883BE693350X",
    },
    {
      batchId: "7Y5GP4ETNLCUQ",
      itemId: "2FN4JTY2SF8A2",
      receiver: "landfall-recipient-002@example.com",
      amountUsd: "$1.00",
      status: "UNCLAIMED",
      txId: "37H27417P36178843",
    },
  ],
}: {
  items?: PayoutItemRow[];
}) {
  const successCount = items.filter((i) => i.status === "SUCCESS").length;
  const unclaimedCount = items.filter((i) => i.status === "UNCLAIMED").length;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-delivered0" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            Real PayPal Sandbox test payouts
          </h3>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-delivered0/20 text-delivered border border-delivered0/30">
            {successCount} SUCCESS
          </span>
          {unclaimedCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber0/20 text-amber border border-amber0/30">
              {unclaimedCount} UNCLAIMED
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/[0.07] text-ink-2">
              <th className="pb-2 font-medium">Batch ID</th>
              <th className="pb-2 font-medium">Item ID</th>
              <th className="pb-2 font-medium">Receiver Account</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">PayPal Tx ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {items.map((it) => (
              <tr key={it.itemId} className="text-ink-2 hover:bg-surface-3/40">
                <td className="py-2.5 text-paypal">{it.batchId}</td>
                <td className="py-2.5 text-ink">{it.itemId}</td>
                <td className="py-2.5 text-ink-2 max-w-[200px] truncate">{it.receiver}</td>
                <td className="py-2.5 text-delivered font-bold">{it.amountUsd}</td>
                <td className="py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      it.status === "SUCCESS"
                        ? "bg-delivered0/20 text-delivered border border-delivered0/40"
                        : "bg-amber0/20 text-amber border border-amber0/40"
                    }`}
                  >
                    {it.status}
                  </span>
                </td>
                <td className="py-2.5 text-ink-2">{it.txId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

