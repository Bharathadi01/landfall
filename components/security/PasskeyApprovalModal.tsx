"use client";

import React, { useState, useEffect } from "react";
import { browserSupportsPasskeys, startAuthentication } from "@simplewebauthn/browser";
import { type ApprovalKeyVerification, validateTwoKeyApproval } from "@/lib/security/passkeys";
import { I } from "@/components/icons";

export interface PasskeyApprovalModalProps {
  isOpen: boolean;
  planHash: string;
  planId?: string;
  recipientCount?: number;
  totalAmountCents?: number;
  planSummary?: {
    title: string;
    totalAmountFormatted: string;
    householdsCount: number;
    tranche: number;
  };
  onApproved?: (approvals: ApprovalKeyVerification[]) => void;
  onBothApproved?: (approvals: ApprovalKeyVerification[]) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function PasskeyApprovalModal({
  isOpen,
  planHash,
  planId = "plan_active",
  recipientCount = 0,
  totalAmountCents = 0,
  planSummary,
  onApproved,
  onBothApproved,
  onCancel,
  onClose,
}: PasskeyApprovalModalProps) {
  const [hasPasskeySupport, setHasPasskeySupport] = useState<boolean | null>(null);
  const [approver1Signed, setApprover1Signed] = useState(false);
  const [approver2Signed, setApprover2Signed] = useState(false);
  const [signingApprover, setSigningApprover] = useState<1 | 2 | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [collectedApprovals, setCollectedApprovals] = useState<ApprovalKeyVerification[]>([]);
  const [released, setReleased] = useState(false);

  const handleClose = onClose || onCancel || (() => {});
  const handleSuccess = (approvals: ApprovalKeyVerification[]) => {
    if (onBothApproved) onBothApproved(approvals);
    if (onApproved) onApproved(approvals);
  };

  const summary = planSummary || {
    title: `Payout Plan: ${planId}`,
    totalAmountFormatted: `$${(totalAmountCents / 100).toFixed(2)} USD`,
    householdsCount: recipientCount,
    tranche: 1,
  };

  useEffect(() => {
    // Check if browser environment supports FIDO2 / WebAuthn passkeys
    browserSupportsPasskeys()
      .then((supported) => setHasPasskeySupport(supported))
      .catch(() => setHasPasskeySupport(false));
  }, []);

  if (!isOpen) return null;

  const handleSignApprover = async (approverIndex: 1 | 2) => {
    setErrorMsg(null);
    setSigningApprover(approverIndex);

    const isFinance = approverIndex === 2;
    const approverName = isFinance ? "Marcus Vance [DEMO PERSONA]" : "Elena Rostova [DEMO PERSONA]";
    const approverRole = isFinance ? "finance" : "coordinator";
    const approverId = isFinance ? "fiduciary_lead_01" : "ops_coordinator_01";

    let signatureHash = "";

    try {
      // 1. Fetch passkey auth challenge from server (bound to planHash)
      const optionsRes = await fetch("/api/auth/passkey/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planHash }),
      });

      if (optionsRes.ok && hasPasskeySupport) {
        const optionsJSON = await optionsRes.json();
        try {
          // Attempt real browser WebAuthn biometric assertion
          const authResult = await startAuthentication({ optionsJSON });
          signatureHash = authResult.id || `fido2_sig_${Date.now()}`;
        } catch (webauthnErr: any) {
          // Graceful fallback for non-registered authenticator in test environment
          console.warn("[WEBAUTHN] Hardware passkey prompt bypassed or failed, using simulated key:", webauthnErr);
          signatureHash = `simulated_passkey_sig_${approverId}_${Date.now()}`;
        }
      } else {
        signatureHash = `simulated_passkey_sig_${approverId}_${Date.now()}`;
      }

      const approvalRecord: ApprovalKeyVerification = {
        approverId,
        approverRole: approverRole as "coordinator" | "finance",
        planHash,
        passkeySignature: signatureHash,
      };

      const updated = [...collectedApprovals.filter((a) => a.approverId !== approverId), approvalRecord];
      setCollectedApprovals(updated);

      if (approverIndex === 1) setApprover1Signed(true);
      if (approverIndex === 2) setApprover2Signed(true);

      // Check if both distinct approvers have signed
      if (updated.length >= 2) {
        const validation = validateTwoKeyApproval(updated, planHash);
        if (validation.valid) {
          // Let the "plan released" moment register before handing control back.
          setReleased(true);
          window.setTimeout(() => handleSuccess(updated), 1600);
        } else {
          setErrorMsg(validation.error || "Dual approval validation failed");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete passkey signing");
    } finally {
      setSigningApprover(null);
    }
  };

  const signers = [
    { idx: 1 as const, name: "Elena Rostova", role: "Relief coordinator", key: "Key 1", signed: approver1Signed, tone: "paypal" },
    { idx: 2 as const, name: "Marcus Vance", role: "Finance director · required", key: "Key 2", signed: approver2Signed, tone: "amber" },
  ];
  const signedCount = Number(approver1Signed) + Number(approver2Signed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-field-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passkey-title"
    >
      <div className="glass-strong relative w-full max-w-lg overflow-hidden p-6 sm:p-7 animate-field-scale">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-amber/15 blur-[80px]" aria-hidden />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="icon-tile icon-tile-lg tone-amber">
              <I.passkey />
            </span>
            <div>
              <div className="eyebrow text-amber">Two-person approval</div>
              <h2 id="passkey-title" className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
                Two keys release the money
              </h2>
              <p className="mt-1 text-[13px] text-ink-3">Each person signs this exact plan with a passkey. Change anything and both must sign again.</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-white/5 hover:text-ink" aria-label="Close">
            <I.close className="h-5 w-5" />
          </button>
        </div>

        {/* Plan */}
        <div className="relative mt-6 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
          <div className="text-[13px] text-ink-2">{summary.title}</div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-[30px] font-semibold tracking-[-0.035em] text-accent-strong tabular">{summary.totalAmountFormatted.replace(" USD", "")}</span>
            <span className="text-[13px] text-ink-2">{summary.householdsCount} households</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3 font-mono text-[10.5px] text-ink-3">
            <I.biometric className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">Plan hash</span>
            <span className="truncate text-paypal" title={planHash}>{planHash}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-[12.5px] text-danger">
            <I.warning className="h-4 w-4 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Signers */}
        <div className="relative mt-4 space-y-2.5">
          {signers.map((s) => (
            <div
              key={s.idx}
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-500 ${
                s.signed ? "border-accent/35 bg-accent/[0.08]" : "border-white/[0.07] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold ${
                    s.signed ? "bg-accent text-on-accent" : s.tone === "amber" ? "bg-amber/15 text-amber" : "bg-paypal/15 text-paypal"
                  }`}
                >
                  {s.signed ? <I.check className="h-5 w-5" strokeWidth={2.5} /> : s.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">
                    {s.name} <span className="ml-1 font-mono text-[9.5px] font-normal uppercase tracking-wider text-ink-3">demo persona</span>
                  </div>
                  <div className="text-[12px] text-ink-3">{s.role}</div>
                </div>
              </div>
              {s.signed ? (
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-strong">
                  <I.signed className="h-4 w-4" /> Signed
                </span>
              ) : (
                <button
                  onClick={() => handleSignApprover(s.idx)}
                  disabled={signingApprover !== null || released}
                  className={`field-btn px-3.5 py-2 text-[13px] ${s.tone === "amber" ? "field-btn-secondary !border-amber/40 !text-amber" : "field-btn-paypal"}`}
                >
                  <I.passkey className="h-4 w-4" />
                  {signingApprover === s.idx ? "Signing…" : `Sign ${s.key}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Progress / release */}
        <div className="relative mt-5">
          {released ? (
            <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 animate-field-scale" style={{ boxShadow: "var(--glow-accent)" }}>
              <span className="icon-tile tone-accent"><I.send /></span>
              <div>
                <div className="text-[14px] font-semibold text-ink">Plan released to PayPal Payouts</div>
                <div className="text-[12px] text-ink-3">Both signatures verified against the plan hash.</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[12px] text-ink-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1].map((i) => (
                    <span key={i} className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${i < signedCount ? "bg-accent" : "bg-white/10"}`} />
                  ))}
                </div>
                {signedCount} of 2 signed
              </div>
              <span title="Passkey assertions are collected here, but this build does not verify them server-side.">Demo passkeys · not server-verified</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
