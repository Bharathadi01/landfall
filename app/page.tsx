"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  HeartHandshake,
  Users,
  CheckCircle2,
  Lock,
  ExternalLink,
  Sparkles,
  CloudRain,
  DollarSign,
  Clock,
  ShieldAlert,
  ChevronRight,
  Info,
  Layers,
  FileCheck2,
} from "lucide-react";

export default function HomePage() {
  const [donationAmount, setDonationAmount] = useState<string>("50.00");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [donationError, setDonationError] = useState<string | null>(null);

  const presetAmounts = ["25.00", "50.00", "100.00", "250.00"];

  const handleCreateDonation = async () => {
    setIsCreatingOrder(true);
    setDonationError(null);
    setOrderSuccess(null);

    const amountToSend = customAmount ? parseFloat(customAmount).toFixed(2) : donationAmount;

    try {
      const res = await fetch("/api/donations/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amountToSend,
          fundId: "fund_tbw_001",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.amountUsd?._errors?.[0] || data.error || "Failed to create order");
      }

      setOrderSuccess({
        orderId: data.orderId,
        status: data.status,
        amount: amountToSend,
        debugId: data.debugId,
      });
    } catch (err: any) {
      setDonationError(err.message || "Failed to process sandbox donation");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="flex flex-col space-y-24 md:space-y-32 pb-24 overflow-x-hidden">
      {/* 1. HERO SECTION: EDITORIAL SPLIT LAYOUT */}
      <section className="pt-8 md:pt-16 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Mission, Headline & Plain Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E0EEE7] text-[#175B47] text-xs font-mono font-bold tracking-wide border border-[#97D5B2]">
              <Compass className="w-3.5 h-3.5" />
              <span>FIELD ATLAS · ANTICIPATORY DISASTER RELIEF</span>
            </div>

            <h1 className="text-hero text-[#192A24] font-bold tracking-tight">
              Relief should be ready before the storm.
            </h1>

            <p className="text-body-large text-[#58665F] max-w-2xl leading-relaxed">
              Landfall connects disaster intelligence, emergency funding, and accountable payouts in one workflow — helping response teams prepare financial assistance before impact.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/console/war-room"
                className="field-btn field-btn-primary px-6 py-3.5 text-base shadow-md hover:shadow-lg"
              >
                <span>Explore Landfall</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>

              <Link
                href="/console/golden-flow"
                className="field-btn field-btn-secondary px-6 py-3.5 text-base"
              >
                <Activity className="w-4 h-4 text-[#175B47] mr-1" />
                <span>Open the live demonstration</span>
              </Link>
            </div>

            {/* Trust Invariants Badge Strip */}
            <div className="pt-6 border-t border-[#DEDCD3] flex flex-wrap items-center gap-6 text-xs text-[#58665F] font-mono">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#175B47]" />
                <span>PayPal Sandbox Verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#175B47]" />
                <span>Two-Person Approval Required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#175B47]" />
                <span>Zero Paid AI Infrastructure</span>
              </div>
            </div>
          </div>

          {/* Right Column: Data-Driven Anticipatory Relief Visual */}
          <div className="lg:col-span-5 w-full">
            <div className="field-paper p-6 space-y-5 border-2 border-[#DEDCD3] shadow-lg relative overflow-hidden">
              {/* Card Header with Status */}
              <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-[#192A24] tracking-wider uppercase">
                    Anticipatory Readiness Monitor
                  </span>
                </div>
                <span className="field-badge field-badge-info">WFO TBW · MILTON</span>
              </div>

              {/* Readiness Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3]">
                  <span className="text-[11px] font-mono uppercase text-[#7B847D] block">
                    Available PayPal Funds
                  </span>
                  <span className="text-xl font-bold font-tabular text-[#192A24] mt-0.5 block">
                    $14,250.00
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3]">
                  <span className="text-[11px] font-mono uppercase text-[#7B847D] block">
                    Protected Reserve
                  </span>
                  <span className="text-xl font-bold font-tabular text-[#58665F] mt-0.5 block">
                    $5,000.00
                  </span>
                </div>
              </div>

              {/* Dynamic Readiness Sequence Preview */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#192A24]">Household Evacuation Preparedness</span>
                  <span className="font-mono text-[#175B47]">24 Households Ready</span>
                </div>
                <div className="h-2 w-full bg-[#ECEAE2] rounded-full overflow-hidden">
                  <div className="h-full bg-[#175B47] rounded-full w-[82%]" />
                </div>
                <div className="flex justify-between text-[11px] text-[#7B847D] font-mono">
                  <span>Tranche 1 Allocation: $500 / household</span>
                  <span>Disbursement Latency: &lt; 3s</span>
                </div>
              </div>

              {/* Storm Approach Mini-Visual */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F2] border border-[#DEDCD3] flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                    <CloudRain className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#192A24] block">Category 4 Eyewall Approach</span>
                    <span className="text-[11px] text-[#58665F]">Tampa Bay · 85 mi offshore · 145 mph</span>
                  </div>
                </div>
                <Link
                  href="/console/sentinel"
                  className="field-btn field-btn-secondary text-xs px-2.5 py-1"
                >
                  Inspect Map
                </Link>
              </div>

              {/* Bottom Assurance Note */}
              <div className="text-[11px] text-[#7B847D] leading-tight">
                Deterministic governance: funds only disburse upon confirmed NWS Hurricane Warning and two-person cryptographic signature.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE PROBLEM SECTION: WHY PREPARING RELIEF EARLY MATTERS */}
      <section id="problem" className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="field-paper p-8 md:p-12 space-y-8 bg-[#FFFEFA]">
          <div className="max-w-2xl space-y-3">
            <span className="text-micro text-[#175B47]">01 · THE PROBLEM</span>
            <h2 className="text-title-1 text-[#192A24]">
              Aid that arrives months late forces families into predatory debt.
            </h2>
            <p className="text-body-base text-[#58665F]">
              Post-disaster assessments cite an average of 60 to 90 days before federal or institutional recovery grants reach individual households. By then, vulnerable residents have exhausted savings or taken high-interest loans for basic fuel, hotel lodging, and food.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="p-6 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3] space-y-3">
              <div className="text-2xl font-bold font-mono text-[#D76E4B]">60–90 Days</div>
              <h3 className="text-heading text-[#192A24]">The Post-Impact Delay</h3>
              <p className="text-sm text-[#58665F] leading-relaxed">
                Conventional disaster relief mobilizes only after physical assessment teams certify debris footprints, delaying liquid emergency capital during the critical evacuation window.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3] space-y-3">
              <div className="text-2xl font-bold font-mono text-[#175B47]">&lt; 3 Seconds</div>
              <h3 className="text-heading text-[#192A24]">The Anticipatory Solution</h3>
              <p className="text-sm text-[#58665F] leading-relaxed">
                Informed by empirical research from the World Food Programme and World Bank, unconditional cash transfers delivered <strong>before</strong> peak winds protect household assets and accelerate community recovery.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3] space-y-3">
              <div className="text-2xl font-bold font-mono text-[#316B9B]">100% Accountable</div>
              <h3 className="text-heading text-[#192A24]">Deterministic Governance</h3>
              <p className="text-sm text-[#58665F] leading-relaxed">
                Landfall enforces double-entry ledger balancing, protected reserve floors, and two-person WebAuthn approvals before PayPal Payouts dispatches single or batch transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW LANDFALL WORKS — FOUR SIMPLE STAGES */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-micro text-[#175B47]">02 · THE WORKFLOW</span>
          <h2 className="text-title-1 text-[#192A24]">Four steps to anticipatory relief</h2>
          <p className="text-body-base text-[#58665F]">
            A transparent, deterministic execution sequence connecting donor funds directly to vulnerable households.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stage 1: Prepare */}
          <div className="field-paper p-6 space-y-4 hover:border-[#175B47] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#E0EEE7] text-[#175B47] flex items-center justify-center font-bold font-mono text-sm">
              01
            </div>
            <h3 className="text-heading text-[#192A24]">Prepare</h3>
            <p className="text-sm text-[#58665F] leading-relaxed">
              Collect and track community contributions into an auditable PayPal balance while enforcing a mandatory protected reserve floor.
            </p>
            <div className="text-xs font-mono text-[#175B47] font-semibold pt-2 border-t border-[#DEDCD3]">
              Double-Entry Ledger Active
            </div>
          </div>

          {/* Stage 2: Prioritise */}
          <div className="field-paper p-6 space-y-4 hover:border-[#175B47] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#E0EEE7] text-[#175B47] flex items-center justify-center font-bold font-mono text-sm">
              02
            </div>
            <h3 className="text-heading text-[#192A24]">Prioritise</h3>
            <p className="text-sm text-[#58665F] leading-relaxed">
              Match official NWS hurricane warning polygons with verified household rosters to identify priority medical and elderly residents in evacuation zones.
            </p>
            <div className="text-xs font-mono text-[#175B47] font-semibold pt-2 border-t border-[#DEDCD3]">
              Deterministic Policy Engine
            </div>
          </div>

          {/* Stage 3: Authorise */}
          <div className="field-paper p-6 space-y-4 hover:border-[#175B47] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#E0EEE7] text-[#175B47] flex items-center justify-center font-bold font-mono text-sm">
              03
            </div>
            <h3 className="text-heading text-[#192A24]">Authorise</h3>
            <p className="text-sm text-[#58665F] leading-relaxed">
              Require two separate human officers (Operations Coordinator + Finance Officer) to approve payouts using hardware-bound WebAuthn passkeys.
            </p>
            <div className="text-xs font-mono text-[#175B47] font-semibold pt-2 border-t border-[#DEDCD3]">
              Two-Person Passkey Signatures
            </div>
          </div>

          {/* Stage 4: Reconcile */}
          <div className="field-paper p-6 space-y-4 hover:border-[#175B47] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#E0EEE7] text-[#175B47] flex items-center justify-center font-bold font-mono text-sm">
              04
            </div>
            <h3 className="text-heading text-[#192A24]">Reconcile</h3>
            <p className="text-sm text-[#58665F] leading-relaxed">
              Execute payouts via verified PayPal Sandbox endpoints, ingest webhooks, resolve exceptions with AI assistance, and produce cryptographic proof.
            </p>
            <div className="text-xs font-mono text-[#175B47] font-semibold pt-2 border-t border-[#DEDCD3]">
              Verifiable Settlement Records
            </div>
          </div>
        </div>
      </section>

      {/* 4. FINANCIAL GOVERNANCE & INTERACTIVE PAYPAL DONATION SIMULATOR */}
      <section id="governance" className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <span className="text-micro text-[#175B47]">03 · PAYPAL INTEGRATION</span>
            <h2 className="text-title-1 text-[#192A24]">
              Financial governance powered by PayPal.
            </h2>
            <p className="text-body-base text-[#58665F]">
              Landfall combines PayPal Orders for transparent donor inflows and PayPal Payouts for rapid emergency disbursement. Every cent is tracked through double-entry accounting with strict reserve floor invariants that prevent over-allocation.
            </p>

            <div className="space-y-3 pt-2 text-sm text-[#58665F]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Idempotent Payout Batches</strong>: Prevents accidental duplicate payments even during network retries or provider timeouts.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Cryptographic Webhook Signatures</strong>: Verifies every PayPal callback with RSA/SHA256 signature verification before updating internal states.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Protected Reserve Floor</strong>: Mathematical check enforces that operating reserves remain completely untouchable.
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Sandbox Donation Order Simulator */}
          <div className="lg:col-span-5 w-full">
            <div className="field-paper p-6 space-y-5 border-2 border-[#DEDCD3]">
              <div className="flex items-center justify-between border-b border-[#DEDCD3] pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#175B47]" />
                  <span className="font-bold text-sm text-[#192A24]">
                    Simulate PayPal Contribution
                  </span>
                </div>
                <span className="field-badge field-badge-neutral">SANDBOX</span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#58665F] block">
                  Select Preset Amount (USD)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {presetAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setDonationAmount(amt);
                        setCustomAmount("");
                      }}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all border ${
                        donationAmount === amt && !customAmount
                          ? "bg-[#175B47] text-[#FFFEFA] border-[#175B47]"
                          : "bg-[#FFFEFA] text-[#192A24] border-[#DEDCD3] hover:bg-[#ECEAE2]"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="1.00"
                    placeholder="Custom amount (e.g. 75.00)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="field-input text-xs"
                  />
                </div>

                <button
                  onClick={handleCreateDonation}
                  disabled={isCreatingOrder}
                  className="w-full field-btn field-btn-primary py-3 text-xs font-bold"
                >
                  {isCreatingOrder ? "Creating PayPal Sandbox Order..." : "Create PayPal Sandbox Order"}
                </button>
              </div>

              {orderSuccess && (
                <div className="p-3 bg-[#E4F4EC] border border-[#97D5B2] rounded-xl text-xs space-y-1 text-[#1B7340]">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Order Created: {orderSuccess.orderId}</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#58665F]">
                    Amount: ${orderSuccess.amount} USD · Status: {orderSuccess.status}
                  </div>
                </div>
              )}

              {donationError && (
                <div className="p-3 bg-[#FDE8E8] border border-[#F5A3A3] rounded-xl text-xs text-[#B92525]">
                  {donationError}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. AI INVESTIGATION AND HUMAN GOVERNANCE */}
      <section id="investigation" className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="field-paper p-8 md:p-12 space-y-8 bg-[#FFFEFA]">
          <div className="max-w-3xl space-y-3">
            <span className="text-micro text-[#175B47]">04 · AI INVESTIGATION & SAFEGUARDS</span>
            <h2 className="text-title-1 text-[#192A24]">
              AI investigates payout exceptions. Humans authorise every dollar.
            </h2>
            <p className="text-body-base text-[#58665F]">
              Landfall uses a zero-cost AI architecture powered by Groq Cloud. The AI Watch Officer operates exclusively under read-only permissions: it analyzes complex payout discrepancies, highlights unverified facts, and drafts action recommendations — but cannot disburse, move, or divert funds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            <div className="space-y-4">
              <h3 className="text-heading text-[#192A24] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#175B47]" />
                <span>What the AI Investigator Does</span>
              </h3>
              <ul className="space-y-2.5 text-sm text-[#58665F]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span>Cross-references provider evidence (PayPal status, recipient record, storm timing).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span>Separately labels verified facts, working hypotheses, and unknown information.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span>Provides actionable next steps to human coordinators without hallucinations.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-heading text-[#192A24] flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" />
                <span>Strict Security Invariants</span>
              </h3>
              <ul className="space-y-2.5 text-sm text-[#58665F]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span><strong>Read-Only Boundary</strong>: AI tools have zero execution privileges on PayPal APIs or the financial ledger.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span><strong>Dual-Passkey Enforcement</strong>: Payouts require physical WebAuthn signatures from two distinct human roles.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#175B47] mt-0.5 flex-shrink-0" />
                  <span><strong>Zero API Costs</strong>: Runs on Groq Free Plan with zero commercial LLM runtime dependencies.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. EVIDENCE & EMPIRICAL CITATIONS */}
      <section id="evidence" className="max-w-7xl mx-auto px-4 sm:px-6 w-full space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-micro text-[#175B47]">05 · SCIENTIFIC GROUNDING</span>
          <h2 className="text-title-1 text-[#192A24]">Verified Data & Research Citations</h2>
          <p className="text-body-base text-[#58665F]">
            Every metric and operational policy in Landfall is grounded in verified public sources and peer-reviewed research.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="field-paper p-5 space-y-2 bg-[#FAF8F2]">
            <span className="text-micro text-[#175B47]">RESEARCH EVIDENCE</span>
            <h4 className="font-bold text-sm text-[#192A24]">World Food Programme & World Bank</h4>
            <p className="text-xs text-[#58665F] leading-relaxed">
              Empirical evaluations demonstrate that anticipatory cash transfers prevent negative coping strategies, reduce distress asset sales, and lower post-disaster recovery costs by over 40%.
            </p>
          </div>

          <div className="field-paper p-5 space-y-2 bg-[#FAF8F2]">
            <span className="text-micro text-[#175B47]">METEOROLOGICAL SOURCES</span>
            <h4 className="font-bold text-sm text-[#192A24]">NOAA nowCOAST & GOES-16 ABI</h4>
            <p className="text-xs text-[#58665F] leading-relaxed">
              Storm Atlas ingests authentic NOAA nowCOAST WMS 1.3.0 base reflectivity radar and GOES-16 ABI Cloud Top Height Level-2 products without procedural or synthetic storm generation.
            </p>
          </div>

          <div className="field-paper p-5 space-y-2 bg-[#FAF8F2]">
            <span className="text-micro text-[#175B47]">PAYPAL PROTOCOLS</span>
            <h4 className="font-bold text-sm text-[#192A24]">PayPal Orders & Payouts v1</h4>
            <p className="text-xs text-[#58665F] leading-relaxed">
              Production-grade integration utilizing PayPal Sandbox client credentials, batch payout idempotency keys, and automated webhook event reconciliation.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FINAL INVITATION CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 w-full text-center space-y-6">
        <div className="field-paper p-10 md:p-14 bg-[#E0EEE7] border-2 border-[#97D5B2] space-y-6">
          <h2 className="text-title-1 text-[#175B47]">
            Experience anticipatory relief in action.
          </h2>
          <p className="text-body-large text-[#192A24] max-w-xl mx-auto">
            Explore the live War Room, step through the 8-stage Golden Workflow, and inspect the Storm Atlas 3D weather intelligence engine.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/console/war-room"
              className="field-btn field-btn-primary px-8 py-3.5 text-base shadow"
            >
              <span>Launch Operations Console</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/r/enroll"
              className="field-btn field-btn-secondary px-6 py-3.5 text-base"
            >
              <span>Resident Assistance Intake</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
