"use client";

import React, { useState, useEffect } from "react";
import { RecipientProfileView } from "@/components/recipients/RecipientProfileView";

export default function CoordinatorRecipientsPage() {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [displacedFilter, setDisplacedFilter] = useState<string>("");
  const [decryptPII, setDecryptPII] = useState<boolean>(false);

  // Selected recipient for profile view
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);

  // Active view: directory or appeals
  const [activeTab, setActiveTab] = useState<"directory" | "appeals">("directory");
  const [appeals, setAppeals] = useState<any[]>([]);

  const fetchRecipients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      if (displacedFilter) params.set("isDisplaced", displacedFilter);
      if (decryptPII) {
        params.set("decrypt", "true");
        params.set("actorId", "coordinator_active_session");
        params.set("actorRole", "coordinator");
      }

      const res = await fetch(`/api/recipients?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load recipients");
      setRecipients(data.recipients || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppeals = async () => {
    try {
      const res = await fetch("/api/recipients/appeal");
      const data = await res.json();
      if (res.ok) {
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      console.error("Failed to load appeals:", err);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, [statusFilter, channelFilter, displacedFilter, decryptPII]);

  useEffect(() => {
    if (activeTab === "appeals") {
      fetchAppeals();
    }
  }, [activeTab]);

  const handleReconfirm = async (householdId: string) => {
    const res = await fetch("/api/recipients/reconfirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId }),
    });
    if (res.ok) {
      await fetchRecipients();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Recipient Management & Inclusion Console
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Anticipatory aid directory, four-check verification chips, and auditable 24h appeals queue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("directory")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "directory"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Recipient Directory
            </button>
            <button
              onClick={() => setActiveTab("appeals")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                activeTab === "appeals"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Appeals Queue
              {appeals.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                  {appeals.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "directory" ? (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Channel Filter */}
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Payment Channels</option>
                  <option value="PAYPAL_ID">Verified PayPal ID</option>
                  <option value="EMAIL">Email Payout</option>
                  <option value="MANUAL">Manual Offline Channel</option>
                  <option value="UNSET">Unset</option>
                </select>

                {/* Displaced Filter */}
                <select
                  value={displacedFilter}
                  onChange={(e) => setDisplacedFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Residences</option>
                  <option value="true">Displaced Residents</option>
                  <option value="false">Standard Residence</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="needs_review">Needs Review</option>
                </select>
              </div>

              {/* Decrypt PII Toggle with Security Alert */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={decryptPII}
                    onChange={(e) => setDecryptPII(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Reveal Decrypted PII (Logged in pii_access_log)</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-200 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading recipient directory...</div>
            ) : recipients.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
                No recipients found matching selected criteria.
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Recipient / Version</th>
                      <th className="p-3">Payment Channel</th>
                      <th className="p-3">Residence Evidence</th>
                      <th className="p-3">Hazard Exposure</th>
                      <th className="p-3">Need Tier</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {recipients.map((h) => {
                      const { fourChecks } = h;
                      return (
                        <tr key={h.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <span>{h.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                                v{h.recipientVersion}
                              </span>
                              {h.isDisplaced && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                  Displaced
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{h.address}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                fourChecks.paymentChannel.status === "VERIFIED"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : fourChecks.paymentChannel.status === "MANUAL"
                                  ? "bg-purple-950 text-purple-300 border border-purple-800"
                                  : "bg-blue-950 text-blue-300 border border-blue-800"
                              }`}
                            >
                              {fourChecks.paymentChannel.label}
                            </span>
                            <span className="block text-[11px] text-slate-400 mt-0.5 font-mono">
                              {h.receiver}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                              {fourChecks.residenceEvidence.label}
                            </span>
                            {fourChecks.residenceEvidence.disclaimer && (
                              <span className="block text-[10px] text-amber-400/90 italic mt-0.5">
                                {fourChecks.residenceEvidence.disclaimer}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                fourChecks.exposure.status === "CONFIRMED"
                                  ? "bg-red-950 text-red-300 border border-red-800"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {fourChecks.exposure.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {fourChecks.need.label}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedRecipient(h)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
                            >
                              Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Appeals Review Queue */
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white mb-1">
                Auditable Appeals Queue (24-Hour SLA)
              </h2>
              <p className="text-xs text-slate-400">
                Residents disputing hazard boundary, priority tier, or payment routing. Invariant: AI is forbidden from resolving appeals; coordinator review is strictly auditable.
              </p>
            </div>

            {appeals.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
                No active appeals in queue.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {appeals.map((a) => {
                  const deadline = new Date(a.slaDeadline);
                  const isBreached = Date.now() > deadline.getTime();
                  return (
                    <div
                      key={a.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">
                              {a.caseReference}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                              {a.category}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                isBreached
                                  ? "bg-red-950 text-red-300 border border-red-800"
                                  : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              }`}
                            >
                              SLA: {deadline.toLocaleTimeString()} ({isBreached ? "BREACHED" : "ON TIME"})
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Household: {a.householdId}</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                          {a.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                        {a.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Selected Profile Modal */}
        {selectedRecipient && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <RecipientProfileView
              household={selectedRecipient}
              onClose={() => setSelectedRecipient(null)}
              onReconfirm={handleReconfirm}
            />
          </div>
        )}
      </div>
    </div>
  );
}
