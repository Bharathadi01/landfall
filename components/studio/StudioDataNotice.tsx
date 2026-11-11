"use client";

import React from "react";
import Link from "next/link";
import { useCases } from "@/components/data/DataSourceProvider";

/**
 * Analytics Studio's widgets are built on the full synthetic Milton replay dataset (obligations, approvals, webhooks and
 * recovery proofs for every household), so every widget has a complete evidence chain. When the console is switched to
 * Live Sandbox the rest of the app shows real PayPal records, so say plainly which data this workspace is using.
 */
export function StudioDataNotice({ className = "" }: { className?: string }) {
  const { source, status } = useCases();
  if (status === "loading" || source !== "live") return null;
  return (
    <div role="note" className={`note ${className}`} data-tone="amber" data-testid="studio-data-notice">
      <span className="note-label">Replay data</span>
      This workspace analyses the synthetic Milton replay dataset, so every widget has a complete evidence chain. Your real PayPal Sandbox payments are in{" "}
      <Link href="/console/war-room" className="text-ink underline underline-offset-2">Command Center → Cases</Link>.
    </div>
  );
}
