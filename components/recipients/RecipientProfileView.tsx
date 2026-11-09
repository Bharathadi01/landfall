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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">{household.name}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              v{household.recipientVersion}
            </span>
            {household.isDisplaced && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                Displaced Resident
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">ID: {household.id}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
          >
            Close
          </button>
        )}
      </div>

      {/* Four Verification Chips */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Four Independent Verification Checks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Payment Channel Chip */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Payment Route</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    fourChecks.paymentChannel.status === "VERIFIED"
                      ? "bg-emerald-900/60 text-emerald-300"
                      : fourChecks.paymentChannel.status === "MANUAL"
                      ? "bg-purple-900/60 text-purple-300"
                      : "bg-blue-900/60 text-blue-300"
                  }`}
                >
                  {fourChecks.paymentChannel.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {fourChecks.paymentChannel.label}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">{fourChecks.paymentChannel.detail}</p>
          </div>

          {/* 2. Residence Evidence Chip */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Residence Evidence</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
                  {fourChecks.residenceEvidence.level}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {fourChecks.residenceEvidence.label}
              </p>
            </div>
            {fourChecks.residenceEvidence.disclaimer && (
              <p className="text-[11px] text-amber-400/90 italic mt-2">
                ⚠ {fourChecks.residenceEvidence.disclaimer}
              </p>
            )}
          </div>

          {/* 3. Hazard Exposure Chip */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Hazard Exposure</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    fourChecks.exposure.status === "CONFIRMED"
                      ? "bg-red-900/60 text-red-300"
                      : fourChecks.exposure.status === "OUT_OF_AREA"
                      ? "bg-slate-700 text-slate-300"
                      : "bg-amber-900/60 text-amber-300"
                  }`}
                >
                  {fourChecks.exposure.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {fourChecks.exposure.label}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Assessed against NWS Hurricane Warning cone using landfall home location.
            </p>
          </div>

          {/* 4. Need Priority Chip */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Need Evaluation</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300">
                  Tier {fourChecks.need.priorityTier}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {fourChecks.need.code}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Deterministic policy tier. Paperwork status never alters this assignment.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400">Address:</span>
            <p className="text-slate-200 font-medium mt-0.5">{household.address}</p>
          </div>
          <div>
            <span className="text-slate-400">Payment Destination:</span>
            <p className="text-slate-200 font-mono mt-0.5">{household.receiver}</p>
          </div>
          <div>
            <span className="text-slate-400">Enrollment Channel:</span>
            <p className="text-slate-200 mt-0.5">
              {household.enrollmentMethod} ({household.recipientPath})
            </p>
          </div>
          <div>
            <span className="text-slate-400">Last Reconfirmed:</span>
            <p className="text-slate-200 mt-0.5">
              {household.reconfirmedAt
                ? new Date(household.reconfirmedAt).toLocaleDateString()
                : "Not reconfirmed"}
            </p>
          </div>
        </div>

        {/* Displacement details if applicable */}
        {household.isDisplaced && (
          <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300/90">
            <strong>Displacement Notice:</strong> Landfall coordinates ({household.lat}, {household.lng})
            preserved for hazard models. Temporary current coordinates ({household.currentLat}, {household.currentLng})
            tracked in location history.
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-slate-500">
          Modifying destination increments version and invalidates unsubmitted plan approvals.
        </span>
        {onReconfirm && (
          <button
            onClick={handleReconfirmClick}
            disabled={reconfirming || reconfirmedSuccess}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white transition-colors"
          >
            {reconfirmedSuccess ? "✓ Reconfirmed" : reconfirming ? "Saving..." : "Reconfirm 'Still Here'"}
          </button>
        )}
      </div>
    </div>
  );
}
