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
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
            5. PayPal Payout Settlement Health
          </h3>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {successCount} SUCCESS
          </span>
          {unclaimedCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {unclaimedCount} UNCLAIMED
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/[0.07] text-slate-400">
              <th className="pb-2 font-medium">Batch ID</th>
              <th className="pb-2 font-medium">Item ID</th>
              <th className="pb-2 font-medium">Receiver Account</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">PayPal Tx ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((it) => (
              <tr key={it.itemId} className="text-slate-300 hover:bg-slate-800/40">
                <td className="py-2.5 text-sky-400">{it.batchId}</td>
                <td className="py-2.5 text-slate-200">{it.itemId}</td>
                <td className="py-2.5 text-slate-400 max-w-[200px] truncate">{it.receiver}</td>
                <td className="py-2.5 text-emerald-400 font-bold">{it.amountUsd}</td>
                <td className="py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      it.status === "SUCCESS"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {it.status}
                  </span>
                </td>
                <td className="py-2.5 text-slate-400">{it.txId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

