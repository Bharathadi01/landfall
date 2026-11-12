"use client";

import React, { useState } from "react";
import Link from "next/link";
import { I } from "@/components/icons";
import { LandfallStudio } from "@/components/studio/LandfallStudio";
import { PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";

/**
 * Analytics Studio (AG Studio). One primary action: ask the AI about the data. The board itself is the content; the only other thing a visitor
 * needs to know is which data it shows, said once.
 */
export default function AnalyticsStudioPage() {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const aiOpen = mode === "edit";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Did it land? · Analytics Studio · built on AG Studio"
        title="Every relief dollar,"
        accent="explorable."
        description="Click any chart to filter the whole board, switch pages with the tabs, or ask the AI a question in plain English. The AI can rearrange this board; it can never move money."
        actions={
          aiOpen ? (
            <Button variant="glass" onClick={() => setMode("view")} data-testid="studio-ai-close">Close the AI panel</Button>
          ) : (
            <Button variant="signal" onClick={() => setMode("edit")} data-testid="studio-ai-open" leading={<I.aiAdvisor className="h-4 w-4" />}>Ask the AI about this data</Button>
          )
        }
      />

      <p className="note" data-tone="amber" data-testid="studio-data-line">
        <span className="note-label">Replay data</span>A fictional Hurricane Milton (Oct 2024) fund, so every chart has a full evidence chain. Your real PayPal Sandbox payments are in{" "}
        <Link href="/console/payments" className="link font-semibold">Payments</Link>.
        {aiOpen && <> The AI panel is open on the left: type a question and press Enter.</>}
      </p>

      <div className="pane h-[900px] w-full overflow-hidden !bg-canvas">
        <LandfallStudio mode={mode} />
      </div>
    </div>
  );
}
