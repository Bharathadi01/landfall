import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowLeft, Terminal, Shield, RefreshCw } from "lucide-react";
import { db } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SpikePage() {
  let events: typeof auditEvents.$inferSelect[] = [];
  try {
    events = await db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(50);
  } catch (e) {
    console.error("Failed to load audit events for /spike:", e);
  }

  const milestones = [
    { name: "OAuth Token Caching (5m early refresh)", status: "verified", desc: "Cached in-memory, audited with token_type & latency" },
    { name: "Payouts Batch (3 x $1 Disbursements)", status: "ready", desc: "Real sandbox email (SUCCESS), synthetic (UNCLAIMED), phone (Venmo)" },
    { name: "Batch Idempotency Guard", status: "ready", desc: "Duplicate sender_batch_id safely rejected within 30-day window" },
    { name: "Cancel Unclaimed Item", status: "ready", desc: "Cancels UNCLAIMED item directly into RETURNED status" },
    { name: "Orders v2 ($5 Donation Capture)", status: "ready", desc: "Captures donation and logs order with custom_id" },
    { name: "Webhook Cryptographic Verification", status: "ready", desc: "Verifies payload against PayPal certificates" },
    { name: "Audit Trail Persistence", status: "verified", desc: "Every call written to audit_events table with secrets redacted" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">PayPal Sandbox Spike Testbed</h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-warningAmber border border-warningAmber/30">
                  SANDBOX ONLY
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Live verification of PayPal Payouts, Orders, Webhooks, and Identity integration
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-slate-500 block">Endpoint</span>
            <span className="text-xs font-mono text-emerald-400">api-m.sandbox.paypal.com</span>
          </div>
        </div>

        {/* Milestone Verification Checklist */}
        <div className="grid md:grid-cols-2 gap-4">
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-800 bg-slate-800/50 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">M1.{idx + 1}</span>
                  <h3 className="text-sm font-semibold text-slate-200">{m.name}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-[11px] font-mono uppercase font-bold shrink-0 ${
                  m.status === "verified"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}
              >
                {m.status}
              </span>
            </div>
          ))}
        </div>

        {/* CLI Command Helper */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Terminal className="w-4 h-4" /> Run Live Spike Script
          </div>
          <div className="p-3 rounded-lg bg-black font-mono text-xs text-emerald-300 flex items-center justify-between">
            <code>pnpm spike:paypal</code>
            <span className="text-slate-500 text-[11px]">Hits real PayPal Sandbox</span>
          </div>
        </div>

        {/* Recent Audit Events Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-ocean-200" /> Recent PayPal Audit Events ({events.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">Append-only audit_events table</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No audit events recorded yet. Run the spike script to generate live traffic!
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 font-mono text-xs">
                {events.map((ev) => (
                  <div key={ev.id} className="p-4 hover:bg-slate-900/60 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-ocean/30 text-ocean-200 text-[11px] font-bold">
                          {ev.actor}
                        </span>
                        <span className="text-slate-200 font-semibold">{ev.action}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-500">
                        {ev.debugId && (
                          <span className="text-amber-400/90 text-[11px]">
                            debug_id: {ev.debugId}
                          </span>
                        )}
                        <span className="text-[11px]">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ""}
                        </span>
                      </div>
                    </div>
                    {Boolean(ev.responseRedacted) && (
                      <pre className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded overflow-x-auto max-h-36">
                        {JSON.stringify(ev.responseRedacted, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
