"use client";

import React, { useState } from "react";
import {
  studioRecoveryProofs,
  studioApprovalEvents,
  studioLedgerReconciliation,
  studioPayoutItems,
} from "@/lib/studio/landfall-studio-data";

export const EVIDENCE_CHAIN_WIDGET_TYPE = "landfall-evidence-chain";

export function RecoveryEvidenceChainWidget() {
  const [activeNode, setActiveNode] = useState<number>(0);

  const proof = studioRecoveryProofs[0];
  const approvals = studioApprovalEvents;
  const ledger = studioLedgerReconciliation;
  const item = studioPayoutItems[1]; // Focus on the exception item for clear audit trail

  const nodes = [
    {
      id: "obligation",
      label: "1. Approved Obligation",
      code: "obl_milton_002",
      type: "Policy Rule",
      status: "VERIFIED",
      verificationType: "Cryptographically Verified",
      color: "#2DD4BF",
      details: "Priority Tier 2 (Elderly Living Alone) · $500.00 grant approved under deterministic Milton Policy v2024. Digest computed locally.",
    },
    {
      id: "approval",
      label: "2. Dual-Passkey Custody",
      code: "2 of 2 Passkeys",
      type: "WebAuthn ES256",
      status: "VERIFIED",
      verificationType: "Cryptographically Verified",
      color: "#2DD4BF",
      details: `${approvals[0].approver_name} + ${approvals[1].approver_name} signed plan digest sha256_46d8... using FIDO2 hardware tokens.`,
    },
    {
      id: "batch",
      label: "3. PayPal Payout Batch",
      code: "BATCH-7Y5GP4ETNLCUQ",
      type: "PayPal Payouts v1",
      status: "SUBMITTED",
      verificationType: "Externally Reported",
      color: "#54A0FF",
      details: "Batch accepted by PayPal node over HTTPS REST rail. External provider statement; verified via HTTP 201 response payload.",
    },
    {
      id: "item",
      label: "4. Payout Item & Status",
      code: "item_milton_002",
      type: "Provider Item",
      status: "UNCLAIMED",
      verificationType: "Externally Reported",
      color: "#FBBF54",
      details: "PayPal authoritative item status UNCLAIMED. Reported by PayPal API. Proof confirms report observation, not resident receipt.",
    },
    {
      id: "webhook",
      label: "5. Webhook Observation",
      code: "WH-2L3991054H810932A",
      type: "HMAC SHA-256",
      status: "VERIFIED",
      verificationType: "Cryptographically Verified",
      color: "#2DD4BF",
      details: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED received. HMAC SHA-256 header verified using PayPal public certificate.",
    },
    {
      id: "ledger",
      label: "6. Ledger Reconciliation",
      code: "ledg_003 · 0¢ Var",
      type: "Double-Entry Book",
      status: "RECONCILED",
      verificationType: "Cryptographically Verified",
      color: "#2DD4BF",
      details: `Disbursed and committed entries balanced across ${ledger.length} accounts with exactly 0¢ variance in immutable journal.`,
    },
    {
      id: "proof",
      label: "7. Settlement Proof",
      code: proof.proof_id,
      type: "Merkle Root",
      status: "ANCHORED",
      verificationType: "Cryptographically Verified",
      color: "#A78BFA",
      details: `Batch Merkle Root: ${proof.merkle_root.substring(0, 22)}...anchoring batch approvals & ledger state. Individual delivery receipt for Arthur Pendelton remains NOT LINKED — PENDING RECIPIENT CLAIM.`,
    },
  ];

  const current = nodes[activeNode];

  return (
    <div
      data-testid="recovery-evidence-chain-widget"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "10px 14px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#EEF2F8",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", textTransform: "uppercase", color: "#6E7A91", letterSpacing: "0.08em" }}>
            End-to-End Traceability Chain
          </div>
          <div style={{ fontSize: 14, fontWeight: 650, color: "#EEF2F8", marginTop: 2 }}>
            Obligation → Payout Item → Ledger → Recovery Proof
          </div>
        </div>

        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-geist-mono)",
            background: "rgba(45, 212, 191, 0.12)",
            border: "1px solid rgba(45, 212, 191, 0.3)",
            color: "#5EEAD4",
            padding: "3px 8px",
            borderRadius: 6,
          }}
        >
          Chain Intact · 7 of 7 Linked
        </span>
      </div>

      {/* Horizontal Nodes Ribbon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
          padding: "6px 0",
          overflowX: "auto",
        }}
      >
        {nodes.map((node, i) => {
          const isSelected = i === activeNode;
          return (
            <React.Fragment key={node.id}>
              <button
                onClick={() => setActiveNode(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: isSelected ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.02)",
                  border: isSelected ? `1px solid ${node.color}` : "1px solid rgba(255, 255, 255, 0.06)",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  minWidth: 82,
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: node.color,
                    marginBottom: 4,
                    boxShadow: isSelected ? `0 0 8px ${node.color}` : "none",
                  }}
                />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: isSelected ? "#EEF2F8" : "#A3AEC2" }}>
                  {node.type}
                </span>
                <span style={{ fontSize: 8.5, fontFamily: "var(--font-geist-mono)", color: node.color, marginTop: 1 }}>
                  {node.status}
                </span>
              </button>
              {i < nodes.length - 1 && (
                <span style={{ color: "rgba(255, 255, 255, 0.2)", fontSize: 11, margin: "0 2px" }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Detail Inspector Card */}
      <div
        style={{
          marginTop: 10,
          background: "rgba(255, 255, 255, 0.03)",
          border: `1px solid ${current.color}44`,
          borderRadius: 10,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#EEF2F8" }}>{current.label}</span>
            <span
              style={{
                fontSize: 9.5,
                padding: "2px 6px",
                borderRadius: 4,
                background: current.verificationType.includes("Crypto") ? "rgba(45, 212, 191, 0.15)" : "rgba(84, 160, 255, 0.15)",
                color: current.verificationType.includes("Crypto") ? "#2DD4BF" : "#54A0FF",
                border: `1px solid ${current.verificationType.includes("Crypto") ? "#2DD4BF44" : "#54A0FF44"}`,
                fontWeight: 600,
              }}
            >
              {current.verificationType}
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-geist-mono)",
              background: `${current.color}1A`,
              color: current.color,
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {current.code}
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: "#A3AEC2", margin: 0, lineHeight: 1.5 }}>{current.details}</p>
      </div>

      {/* Distinction Explainer */}
      <div style={{ marginTop: "auto", paddingTop: 6, fontSize: 10, color: "#6E7A91", display: "flex", justifyContent: "space-between" }}>
        <span>Note: Merkle proof verifies local approvals & ledger; PayPal status is an externally observed API report.</span>
        <span>Zero Ledger Variance · 30% Floor Protected</span>
      </div>
    </div>
  );
}

