"use client";


import { PageTitle } from "@/components/ui/primitives";
import { Users as __HeaderIcon } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { RecipientProfileView } from "@/components/recipients/RecipientProfileView";
import {
  Search,
  Filter,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function CoordinatorRecipientsPage() {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return recipients;
    const q = searchQuery.toLowerCase();
    return recipients.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const address = (r.address || "").toLowerCase();
      const id = (r.id || "").toLowerCase();
      const receiver = (r.receiver || "").toLowerCase();
      return name.includes(q) || address.includes(q) || id.includes(q) || receiver.includes(q);
    });
  }, [recipients, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
        <PageTitle
          eyebrow="Households · enrolled residents"
          icon={__HeaderIcon}
          tone="accent"
          title="Every household,"
          accent="verified and protected."
          description="Who is enrolled, what was checked, and their priority. Personal details stay encrypted; residents can appeal any decision within 24 hours."
        />

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-surface-2 p-1.5 rounded-xl border border-line">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "directory"
                ? "bg-surface text-ink font-semibold shadow-xs"
                : "text-ink-3 hover:text-ink"
            }`}
          >
            Recipient Directory ({recipients.length})
          </button>
          <button
            onClick={() => setActiveTab("appeals")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === "appeals"
                ? "bg-surface text-ink font-semibold shadow-xs"
                : "text-ink-3 hover:text-ink"
            }`}
          >
            <span>Appeals Queue</span>
            {appeals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber text-white font-mono">
                {appeals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "directory" ? (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="field-paper p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Search box */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search resident, ID, address..."
                  className="field-input pl-9 pr-3 py-1.5 text-xs w-full bg-surface"
                />
              </div>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="field-input text-xs py-1.5 px-3 bg-surface"
                aria-label="Filter by payment channel"
              >
                <option value="">All Payment Rails</option>
                <option value="PAYPAL_ID">Verified PayPal ID</option>
                <option value="EMAIL">Email Payout</option>
                <option value="MANUAL">Manual Offline Channel</option>
                <option value="UNSET">Unset</option>
              </select>

              {/* Displaced Filter */}
              <select
                value={displacedFilter}
                onChange={(e) => setDisplacedFilter(e.target.value)}
                className="field-input text-xs py-1.5 px-3 bg-surface"
                aria-label="Filter by residence status"
              >
                <option value="">All Residences</option>
                <option value="true">Displaced Residents</option>
                <option value="false">Standard Primary Home</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field-input text-xs py-1.5 px-3 bg-surface"
                aria-label="Filter by intake status"
              >
                <option value="">All Verification Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="needs_review">Needs Review</option>
              </select>
            </div>

            {/* Decrypt PII Toggle with Security Audit Notice */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <label className="text-xs text-ink-2 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={decryptPII}
                  onChange={(e) => setDecryptPII(e.target.checked)}
                  className="rounded border-line text-accent focus:ring-0 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  {decryptPII ? (
                    <Eye className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-ink-3" />
                  )}
                  Decrypt PII (Audit Logged)
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="field-paper p-4 border-storm bg-storm-soft flex items-center gap-3 text-sm text-storm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <strong className="font-semibold">Directory Error:</strong> {error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="field-paper p-12 text-center text-xs text-ink-3">
              Loading recipient directory from secure store...
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="field-paper p-12 text-center text-xs text-ink-3">
              No recipients match the current filter or search criteria.
            </div>
          ) : (
            <div className="field-paper overflow-hidden shadow-sm border border-line">
              <table className="w-full text-left text-xs field-table">
                <thead className="bg-surface-2 text-ink-2 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Recipient / Address</th>
                    <th className="p-3.5">Payment Channel</th>
                    <th className="p-3.5">Residence Evidence</th>
                    <th className="p-3.5">Hazard Exposure</th>
                    <th className="p-3.5">Need Priority Tier</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {filteredRecipients.map((h) => {
                    const { fourChecks } = h;
                    return (
                      <tr key={h.id} className="hover:bg-surface-2/40 transition-colors">
                        <td className="p-3.5 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">{h.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-surface-2 text-ink-2">
                              v{h.recipientVersion}
                            </span>
                            {h.isDisplaced && (
                              <span className="field-badge-warning text-[10px] font-mono">
                                Displaced
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-ink-3 block mt-0.5">{h.address}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={
                              fourChecks.paymentChannel.status === "VERIFIED"
                                ? "field-badge-evergreen font-mono text-[10px]"
                                : "field-badge-neutral font-mono text-[10px]"
                            }
                          >
                            {fourChecks.paymentChannel.label}
                          </span>
                          <span className="block text-[11px] text-ink-3 mt-1 font-mono">
                            {h.receiver}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="field-badge-neutral font-mono text-[10px]">
                            {fourChecks.residenceEvidence.label}
                          </span>
                          {fourChecks.residenceEvidence.disclaimer && (
                            <span className="block text-[10px] text-amber italic mt-1">
                              {fourChecks.residenceEvidence.disclaimer}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={
                              fourChecks.exposure.status === "CONFIRMED"
                                ? "field-badge-critical font-mono text-[10px]"
                                : "field-badge-neutral font-mono text-[10px]"
                            }
                          >
                            {fourChecks.exposure.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="field-badge-evergreen font-mono text-[10px]">
                            {fourChecks.need.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedRecipient(h)}
                            className="field-btn field-btn-secondary text-xs py-1 px-3"
                          >
                            View Dossier
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
        <div className="space-y-4">
          <div className="field-paper p-5">
            <h2 className="text-xl font-serif font-bold text-ink mb-1">
              Auditable Community Appeals Queue (24-Hour SLA)
            </h2>
            <p className="text-xs text-ink-2">
              Residents disputing hazard boundaries, priority tiers, or payment routing. Invariant: AI is strictly barred from adjudicating appeals; coordinator reviews are recorded in immutable audit logs.
            </p>
          </div>

          {appeals.length === 0 ? (
            <div className="field-paper p-12 text-center text-xs text-ink-3">
              No active resident appeals in the review queue.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {appeals.map((a) => {
                const deadline = new Date(a.slaDeadline);
                const isBreached = Date.now() > deadline.getTime();
                return (
                  <div key={a.id} className="field-paper p-5 space-y-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink font-mono">
                            {a.caseReference}
                          </span>
                          <span className="field-badge-neutral text-[10px] font-mono">
                            {a.category}
                          </span>
                          <span
                            className={
                              isBreached
                                ? "field-badge-critical font-mono text-[10px]"
                                : "field-badge-evergreen font-mono text-[10px]"
                            }
                          >
                            SLA: {deadline.toLocaleTimeString()} ({isBreached ? "BREACHED" : "ON TIME"})
                          </span>
                        </div>
                        <p className="text-xs text-ink-3 mt-1 font-mono">Household ID: {a.householdId}</p>
                      </div>
                      <span className="field-badge-neutral font-mono text-xs">
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink bg-canvas p-3 rounded-lg border border-line leading-relaxed">
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
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <RecipientProfileView
            household={selectedRecipient}
            onClose={() => setSelectedRecipient(null)}
            onReconfirm={handleReconfirm}
          />
        </div>
      )}
    </div>
  );
}
