"use client";

import React, { useEffect, useState } from "react";
import { studioPayoutItems, type PayoutItemRow } from "@/lib/studio/landfall-studio-data";

export const PAYOUT_LIFECYCLE_WIDGET_TYPE = "landfall-payout-lifecycle";

export function PayoutLifecycleWidget(props: any) {
  const { widgetApi, dataMapping } = props;
  const [selectedItem, setSelectedItem] = useState<PayoutItemRow>(studioPayoutItems[1]); // Default to item_milton_002 (UNCLAIMED)
  const [inspectedStep, setInspectedStep] = useState<number | null>(null);

  const statusField = dataMapping?.status?.[0];
  const itemField = dataMapping?.item?.[0];

  useEffect(() => {
    let cancelled = false;
    if (!widgetApi) return;

    widgetApi
      .getData({ fields: [itemField || { id: "payout_items.item_id" }, statusField || { id: "payout_items.transaction_status" }] })
      .then((res: any) => {
        if (cancelled || res?.replaced) return;
        const rows = res?.results?.rows ?? [];
        if (rows.length > 0) {
          const matchedId = rows[0]?.["payout_items.item_id"] || rows[0]?.item_id;
          const found = studioPayoutItems.find((p) => p.item_id === matchedId);
          if (found) setSelectedItem(found);
        }
      })
      .catch(() => {
        /* retain current */
      });

    return () => {
      cancelled = true;
    };
  }, [widgetApi, itemField, statusField]);

  const p = selectedItem;
  const isSuccess = p.transaction_status === "SUCCESS";
  const isUnclaimed = p.transaction_status === "UNCLAIMED";
  const isHold = p.transaction_status === "ONHOLD";
  const isFailed = p.transaction_status === "FAILED";

  const statusColor = isSuccess ? "#268C54" : isUnclaimed ? "#B07012" : isHold ? "#0E6B50" : isFailed ? "#B42318" : "#343D39";

  const timelineSteps = [
    {
      title: "1. Relief Obligation Approved",
      detail: `Approved $500.00 grant for ${p.resident_name} (${p.priority_tier})`,
      time: "18:00 UTC",
      status: "done",
      badge: p.obligation_id,
      evidence: `Obligation ${p.obligation_id} generated under Milton Policy v2024. Household ${p.household_ref} verified in Zone A.`,
    },
    {
      title: "2. Two-person approval",
      detail: "Two different people approved the exact payload: an Operations Lead and a Finance Director. The AI cannot approve.",
      time: "18:05 UTC",
      status: "done",
      badge: "2 OF 2 PEOPLE",
      evidence: "Replay record of a two-person approval. In the live app each approval is a passkey (checked by the server) or the clearly labelled demo key, and the Treasurer then runs the payout once.",
    },
    {
      title: "3. Payout Batch Creation",
      detail: `Idempotent local batch ${p.batch_id} locked`,
      time: "18:10 UTC",
      status: "done",
      badge: "IDEMPOTENT_SHA256",
      evidence: `Batch ${p.batch_id} compiled with immutable checksum. Prevents duplicate submission risk.`,
    },
    {
      title: "4. Provider Submission (PayPal)",
      detail: `Submitted to PayPal Payouts v1 REST API endpoint`,
      time: "18:15 UTC",
      status: "done",
      badge: "PAYPAL_API_ACCEPTED",
      evidence: `Replay record (synthetic): batch ${p.batch_id}, item ${p.item_id}. Not a real PayPal batch.`,
    },
    {
      title: `5. Provider Observation: ${p.transaction_status}`,
      detail: p.status_meaning,
      time: p.last_event_time.replace("T", " ").replace("Z", " UTC"),
      status: isSuccess ? "done" : "attention",
      badge: p.status_label,
      color: statusColor,
      evidence: `Replay observation modelled on PayPal's ${p.transaction_status} status (synthetic data; no webhook was received for this record).`,
    },
    {
      title: "6. Ledger Reconciliation",
      detail: "Matched against double-entry journal · 0¢ discrepancy",
      time: "18:25 UTC",
      status: "done",
      badge: p.reconciliation_status,
      color: "#268C54",
      evidence: "General ledger account 2100 (Disbursed) balanced against 1010 (PayPal Clearing). Minor unit variance: 0 cents.",
    },
    {
      title: isSuccess ? "7. Recovery Proof Anchored" : "7. Recovery Proof: Pending Claim",
      detail: isSuccess
        ? "prf_milton_t1_2024 anchored to Merkle log"
        : "NOT LINKED — PENDING RECIPIENT CLAIM (Within 30-day window)",
      time: isSuccess ? "18:30 UTC" : "Pending Claim",
      status: isSuccess ? "done" : "attention",
      badge: isSuccess ? "PROOF_ANCHORED" : "PENDING_CLAIM",
      color: isSuccess ? "#343D39" : "#B07012",
      evidence: isSuccess
        ? "Proof prf_milton_t1_2024 anchored. Merkle root: 0x8f93e2b1c4a0... Policy 30% reserve preserved."
        : "No individual delivery proof issued while funds remain in PayPal claim window. Caseworker reminder queued.",
    },
  ];

  return (
    <div
      data-testid="payout-lifecycle-widget"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px 14px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#18221E",
        overflowY: "auto",
      }}
    >
      {/* Header with active item selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(24,34,30,0.08)",
          paddingBottom: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-geist-sans)", color: "#525A56" }}>
            Lifecycle Chronology · {p.item_id}
          </div>
          <div style={{ fontSize: 14, fontWeight: 650, color: "#18221E", marginTop: 2 }}>
            {p.resident_name} · <span style={{ color: "#343D39" }}>{p.recipient_wallet}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#525A56", fontFamily: "var(--font-geist-sans)" }}>
            Age: {p.age_hours}h
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 6,
              background: `${statusColor}22`,
              border: `1px solid ${statusColor}55`,
              color: statusColor,
            }}
          >
            {p.transaction_status}
          </span>
        </div>
      </div>

      {/* Chronological Vertical Stepper */}
      <div style={{ columnCount: 2, columnGap: 18, marginTop: 4 }}>
        {timelineSteps.map((step, idx) => {
          const stepDotColor = step.color || (step.status === "done" ? "#268C54" : "#525A56");
          const isInspected = inspectedStep === idx;
          return (
            <div
              key={idx}
              onClick={() => setInspectedStep(isInspected ? null : idx)}
              style={{
                position: "relative",
                breakInside: "avoid",
                marginBottom: 10,
                cursor: "pointer",
                padding: "4px 8px 4px 24px",
                borderRadius: 6,
                background: isInspected ? "rgba(24,34,30,0.06)" : "transparent",
                transition: "background 150ms ease",
              }}
            >
              {/* Dot on Line */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 9,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: step.status === "done" ? stepDotColor : "#F0ECE3",
                  border: `2px solid ${stepDotColor}`,
                }}
              />

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: step.status === "pending" ? "#343D39" : "#18221E" }}>
                  {step.title}
                </span>
                <span style={{ fontSize: 9.5, fontFamily: "var(--font-geist-sans)", color: "#525A56" }}>
                  {step.time}
                </span>
              </div>

              <div style={{ fontSize: 10.5, color: "#343D39", marginTop: 1 }}>{step.detail}</div>

              <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 9,
                    fontFamily: "var(--font-geist-sans)",
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: "rgba(24,34,30,0.05)",
                    border: "1px solid rgba(24,34,30,0.08)",
                    color: step.color || "#343D39",
                  }}
                >
                  {step.badge}
                </span>
                <span style={{ fontSize: 9, color: "#343D39" }}>
                  {isInspected ? "▲ hide evidence" : "▼ click to inspect"}
                </span>
              </div>

              {isInspected && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 8px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.97)",
                    border: "1px solid rgba(76,155,255, 0.25)",
                    fontSize: 10,
                    fontFamily: "var(--font-geist-sans)",
                    color: "#525A56",
                    lineHeight: 1.4,
                  }}
                >
                  {step.evidence}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Safety Notice Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 6,
          borderTop: "1px solid rgba(24,34,30,0.06)",
          fontSize: 10,
          color: "#525A56",
          fontStyle: "italic",
        }}
      >
        Verified provider records only · No state transitions inferred · Payment execution disabled
      </div>
    </div>
  );
}

