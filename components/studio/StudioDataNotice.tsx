"use client";

import React from "react";
import Link from "next/link";
import { useCases } from "@/components/data/DataSourceProvider";
import { Tag } from "@/components/ui/Tag";

/**
 * Analytics Studio's widgets are built on the full synthetic Milton replay dataset (obligations, approvals, webhooks and
 * recovery proofs for every household), so every widget has a complete evidence chain. When the console is switched to
 * Live Sandbox the rest of the app shows real PayPal records, so say plainly which data this workspace is using.
 */
export function StudioDataNotice({ className = "" }: { className?: string }) {
  const { source, status } = useCases();
  if (status === "loading" || source !== "live") return null;
  return (
    <div role="note" className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber/30 bg-amber/[0.07] px-4 py-3 text-[13px] text-ink-2 ${className}`} data-testid="studio-data-notice">
      <Tag tone="storm" solid>Replay data</Tag>
      <span className="min-w-0 flex-1">
        This workspace analyses the synthetic <b className="text-ink">Milton replay</b> dataset, so every widget has a complete evidence chain. Your real PayPal Sandbox payments are in{" "}
        <Link href="/console/war-room" className="text-accent-strong underline underline-offset-2">Command Center → Cases</Link>.
      </span>
    </div>
  );
}
