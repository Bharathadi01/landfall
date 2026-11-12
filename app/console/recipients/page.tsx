"use client";


import { PageHeader } from "@/components/ui/primitives";
import { I } from "@/components/icons";
import { Tag } from "@/components/ui/Tag";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { RecipientProfileView } from "@/components/recipients/RecipientProfileView";

// AG Grid loads with this page only.
const HouseholdGrid = dynamic(() => import("@/components/recipients/HouseholdGrid").then((m) => m.HouseholdGrid), {
  ssr: false,
  loading: () => <div className="pane space-y-3 p-6" role="status" aria-label="Loading the directory"><div className="skeleton h-5 w-1/3" /><div className="skeleton h-[240px] w-full" /></div>,
});

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

  const fetchRecipients = useCallback(async () => {
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
  }, [statusFilter, channelFilter, displacedFilter, decryptPII]);

  const fetchAppeals = useCallback(async () => {
    try {
      const res = await fetch("/api/recipients/appeal");
      const data = await res.json();
      if (res.ok) {
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      console.error("Failed to load appeals:", err);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  useEffect(() => {
    if (activeTab === "appeals") {
      fetchAppeals();
    }
  }, [activeTab, fetchAppeals]);

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
      <PageHeader
        eyebrow="Decide and pay · Households · personal details encrypted"
        title="Every household,"
        accent="known, checked and protected."
        description="Who is enrolled, what was checked, and their priority. Personal details stay encrypted unless someone with a reason opens them, and that is logged. Residents can appeal any decision within 24 hours."
      />

      <div className="tabs" role="tablist" aria-label="Households views">
        <button type="button" role="tab" aria-selected={activeTab === "directory"} className="tab" onClick={() => setActiveTab("directory")}>
          Recipient Directory <span className="tab-count">{recipients.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "appeals"} className="tab" onClick={() => setActiveTab("appeals")}>
          Appeals Queue {appeals.length > 0 && <span className="tab-count">{appeals.length}</span>}
        </button>
      </div>

      {activeTab === "directory" ? (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="pane flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
            <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
              {/* Search box */}
              <div className="relative w-full sm:w-72">
                <I.search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search resident, ID, address..."
                  className="field-input has-icon !min-h-[36px] w-full !py-1.5 text-[13px]"
                />
              </div>

              {/* Channel Filter */}
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="field-input !min-h-[36px] !w-auto min-w-[11rem] !py-1.5 text-[13px]"
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
                className="field-input !min-h-[36px] !w-auto min-w-[11rem] !py-1.5 text-[13px]"
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
                className="field-input !min-h-[36px] !w-auto min-w-[11rem] !py-1.5 text-[13px]"
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
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {decryptPII ? (
                    <I.view className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <I.locked className="w-3.5 h-3.5 text-ink-3" />
                  )}
                  Show personal details (logged)
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="note" data-tone="danger" role="alert"><span className="note-label">Couldn’t load the directory</span>{error}</div>
          )}

          {loading ? (
            <div className="pane space-y-3 p-6" role="status" aria-label="Loading"><div className="skeleton h-5 w-1/3" /><div className="skeleton h-5 w-2/3" /><div className="skeleton h-5 w-1/2" /></div>
          ) : filteredRecipients.length === 0 ? (
            <div className="pane p-10 text-center text-[14px] text-ink-2">
              No households here yet. The live Sandbox view only lists households with stored PayPal payments; switch to <span className="font-semibold text-ink">Milton replay</span> at the top to see a full directory.
            </div>
          ) : (
            <HouseholdGrid rows={filteredRecipients} onOpen={setSelectedRecipient} />
          )}
        </div>
      ) : (
        /* Appeals Review Queue */
        <div className="space-y-4">
          <div>
            <h2 className="text-title-2 text-ink">Appeals, answered within 24 hours</h2>
            <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">
              Residents disputing a warning boundary, their priority or how they are paid. A coordinator decides every appeal; the AI never does, and each review is logged.
            </p>
          </div>

          {appeals.length === 0 ? (
            <div className="pane p-10 text-center text-[14px] text-ink-2">No open appeals. When a resident appeals, it appears here with its 24-hour deadline.</div>
          ) : (
            <ul className="space-y-3">
              {appeals.map((a) => {
                const deadline = new Date(a.slaDeadline);
                const isBreached = Date.now() > deadline.getTime();
                return (
                  <li key={a.id} className="pane space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-code text-[13px] font-semibold text-ink">{a.caseReference}</span>
                          <Tag tone="neutral">{String(a.category).toLowerCase().replace(/_/g, " ")}</Tag>
                          <Tag tone={isBreached ? "danger" : "delivered"}>{isBreached ? "Past the 24-hour deadline" : `Answer by ${deadline.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</Tag>
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-3">Household <span className="font-code">{a.householdId}</span></p>
                      </div>
                      <Tag tone="amber">{String(a.status).toLowerCase().replace(/_/g, " ")}</Tag>
                    </div>
                    <p className="border-l-2 border-line-strong pl-3 text-[14px] leading-relaxed text-ink-2">{a.explanation}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Selected Profile Modal */}
      {selectedRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4">
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
