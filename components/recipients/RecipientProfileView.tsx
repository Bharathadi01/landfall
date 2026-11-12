"use client";

import React, { useState } from "react";
import type { FourChecks, PaymentChannelType, RecipientPath, EvidenceLevel } from "@/lib/recipients/types";

export interface RecipientProfileProps {
  household: {
    id: string;
    fundId: string;
    status: string;
    enrollmentMethod: string;
    paymentChannel: PaymentChannelType;
    recipientPath: RecipientPath;
    recipientVersion: number;
    receiver: string;
    isDisplaced: boolean;
    language: string;
    lat?: number | null;
    lng?: number | null;
    currentLat?: number | null;
    currentLng?: number | null;
    reconfirmedAt?: string | null;
    createdAt: string;
    name: string;
    address: string;
    fourChecks: FourChecks;
  };
  onClose?: () => void;
  onReconfirm?: (householdId: string) => Promise<void>;
}

export function RecipientProfileView({ household, onClose, onReconfirm }: RecipientProfileProps) {
  const [reconfirming, setReconfirming] = useState(false);
  const [reconfirmedSuccess, setReconfirmedSuccess] = useState(false);

  const { fourChecks } = household;

  const handleReconfirmClick = async () => {
    if (!onReconfirm) return;
    setReconfirming(true);
    try {
      await onReconfirm(household.id);
      setReconfirmedSuccess(true);
    } finally {
      setReconfirming(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-xl p-6 text-ink shadow-[0_40px_90px_-30px_rgb(24_34_30/0.5)] w-full max-w-2xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-ink">{household.name}</h2>
            <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-delivered-soft text-delivered border border-delivered-line">
              v{household.recipientVersion}
            </span>
            {household.isDisplaced && (
              <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-amber-soft text-amber border border-amber-line">
                Displaced Resident
              </span>
            )}
          </div>
          <p className="text-xs text-ink-2 font-mono mt-1">ID: {household.id}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-ink-2 hover:text-ink text-sm px-2.5 py-1 rounded-md border border-line hover:bg-surface-2"
          >
            Close
          </button>
        )}
      </div>

      {/* Four Verification Chips */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-2 mb-3">
          Four Independent Verification Checks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Payment Channel Chip */}
          <div className="p-3.5 rounded-md bg-surface-2/60 border border-line flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2 font-medium">Payment Route</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    fourChecks.paymentChannel.status === "VERIFIED"
                      ? "bg-delivered-soft/60 text-delivered"
                      : fourChecks.paymentChannel.status === "MANUAL"
                      ? "bg-ai-soft/60 text-ai"
                      : "bg-paypal-soft/60 text-paypal"
                  }`}
                >
                  {fourChecks.paymentChannel.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink mt-1">
                {fourChecks.paymentChannel.label}
              </p>
            </div>
            <p className="text-xs text-ink-2 mt-2">{fourChecks.paymentChannel.detail}</p>
          </div>

          {/* 2. Residence Evidence Chip */}
          <div className="p-3.5 rounded-md bg-surface-2/60 border border-line flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2 font-medium">Residence Evidence</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-delivered-soft/60 text-delivered">
                  {fourChecks.residenceEvidence.level}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink mt-1">
                {fourChecks.residenceEvidence.label}
              </p>
            </div>
            {fourChecks.residenceEvidence.disclaimer && (
              <p className="text-[11px] text-amber/90 italic mt-2">
                ⚠ {fourChecks.residenceEvidence.disclaimer}
              </p>
            )}
          </div>

          {/* 3. Hazard Exposure Chip */}
          <div className="p-3.5 rounded-md bg-surface-2/60 border border-line flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2 font-medium">Hazard Exposure</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    fourChecks.exposure.status === "CONFIRMED"
                      ? "bg-danger-soft/60 text-danger"
                      : fourChecks.exposure.status === "OUT_OF_AREA"
                      ? "bg-surface-3 text-ink-2"
                      : "bg-amber-soft/60 text-amber"
                  }`}
                >
                  {fourChecks.exposure.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink mt-1">
                {fourChecks.exposure.label}
              </p>
            </div>
            <p className="text-xs text-ink-2 mt-2">
              Assessed against NWS Hurricane Warning cone using landfall home location.
            </p>
          </div>

          {/* 4. Need Priority Chip */}
          <div className="p-3.5 rounded-md bg-surface-2/60 border border-line flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2 font-medium">Need Evaluation</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-ai-soft/60 text-ai">
                  Tier {fourChecks.need.priorityTier}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink mt-1">
                {fourChecks.need.code}
              </p>
            </div>
            <p className="text-xs text-ink-2 mt-2">
              Deterministic policy tier. Paperwork status never alters this assignment.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-surface/60 rounded-lg p-4 border border-line space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-ink-2">Address:</span>
            <p className="text-ink font-medium mt-0.5">{household.address}</p>
          </div>
          <div>
            <span className="text-ink-2">Payment Destination:</span>
            <p className="text-ink font-mono mt-0.5">{household.receiver}</p>
          </div>
          <div>
            <span className="text-ink-2">Enrollment Channel:</span>
            <p className="text-ink mt-0.5">
              {household.enrollmentMethod} ({household.recipientPath})
            </p>
          </div>
          <div>
            <span className="text-ink-2">Last Reconfirmed:</span>
            <p className="text-ink mt-0.5">
              {household.reconfirmedAt
                ? new Date(household.reconfirmedAt).toLocaleDateString()
                : "Not reconfirmed"}
            </p>
          </div>
        </div>

        {/* Displacement details if applicable */}
        {household.isDisplaced && (
          <div className="pt-2 border-t border-line text-[11px] text-amber/90">
            <strong>Displacement Notice:</strong> Landfall coordinates ({household.lat}, {household.lng})
            preserved for hazard models. Temporary current coordinates ({household.currentLat}, {household.currentLng})
            tracked in location history.
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-ink0">
          Modifying destination increments version and invalidates unsubmitted plan approvals.
        </span>
        {onReconfirm && (
          <button
            onClick={handleReconfirmClick}
            disabled={reconfirming || reconfirmedSuccess}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-paypal hover:bg-paypal0 disabled:bg-surface-3 text-white transition-colors"
          >
            {reconfirmedSuccess ? "✓ Reconfirmed" : reconfirming ? "Saving..." : "Reconfirm 'Still Here'"}
          </button>
        )}
      </div>
    </div>
  );
}
