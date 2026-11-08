import Link from "next/link";
import { ShieldCheck, Zap, AlertTriangle, ArrowRight, HeartHandshake, Compass } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-ocean flex items-center justify-center text-white font-black tracking-wider">
              LF
            </div>
            <div>
              <span className="font-bold text-lg text-ocean">LANDFALL</span>
              <span className="text-xs text-slate-500 block -mt-1 font-mono">anticipatory.aid</span>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/enroll" className="text-slate-600 hover:text-ocean transition">
              Enroll (Residents)
            </Link>
            <Link href="/console" className="text-slate-600 hover:text-ocean transition">
              War Room
            </Link>
            <Link href="/ledger" className="text-slate-600 hover:text-ocean transition">
              Public Ledger
            </Link>
            <Link href="/spike" className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 font-mono">
              PayPal Spike
            </Link>
            <Link
              href="/console?judge=1"
              className="bg-warningAmber hover:bg-amber-500 text-slate-950 font-semibold px-3 py-1.5 rounded-md text-xs shadow-sm flex items-center gap-1.5 transition"
            >
              <Zap className="w-3.5 h-3.5" /> Judge Mode
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="py-16 md:py-24 max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ocean-50 text-ocean text-xs font-semibold mb-6 border border-ocean-200">
            <Compass className="w-4 h-4" /> PayPal AI Hackathon 2026
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-950 mb-6">
            Mutual aid always arrives after landfall.
            <br />
            <span className="text-ocean">Landfall makes it arrive before.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            When disasters hit, aid takes months to arrive. Research by the WFP and World Bank shows unconditional cash delivered <strong className="text-slate-900">before</strong> a storm peaks prevents hunger, distress debt, and asset loss. Landfall equips neighborhood funds to send verified pre-disaster payouts on PayPal.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
            <Link
              href="/enroll"
              className="bg-ocean hover:bg-ocean-700 text-white font-medium px-6 py-3 rounded-lg shadow flex items-center gap-2 transition"
            >
              Enroll for Aid <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/console?judge=1"
              className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-medium px-6 py-3 rounded-lg shadow-sm flex items-center gap-2 transition"
            >
              <Zap className="w-4 h-4 text-warningAmber" /> Run Replay in War Room
            </Link>
          </div>

          {/* Golden Rule Banner */}
          <div className="bg-white border-2 border-ocean-200 rounded-xl p-6 shadow-sm max-w-3xl mx-auto text-left">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-ocean-50 text-ocean shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-1">
                  The Golden Rule of Autonomous Aid:
                </h3>
                <p className="text-sm text-slate-700 font-medium">
                  <span className="text-ocean font-bold">AI proposes.</span>{" "}
                  <span className="text-slate-800 font-bold">Rules check.</span>{" "}
                  <span className="text-amber-700 font-bold">A human approves.</span>{" "}
                  <span className="text-emerald-700 font-bold">Only then does PayPal move money.</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Two-key authorization: The deterministic Treasurer only executes if the Auditor agent signature, policy rules, and human coordinator cryptographic token all match the exact plan hash.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Citations & Evidence */}
        <section className="bg-white border-t border-slate-200 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
              Why Anticipatory Cash Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-xs font-mono text-ocean font-bold mb-2">WFP & WORLD BANK RCT</div>
                <h3 className="font-semibold text-slate-900 mb-2">Significant Household Protection</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Randomized trial during Bangladesh monsoon floods proved pre-storm cash transfers reduced borrowing at predatory rates and helped families evacuate safely before peak inundation.
                </p>
              </div>

              <div className="p-5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-xs font-mono text-warningAmber-700 font-bold mb-2">AID TIMING GAP</div>
                <h3 className="font-semibold text-slate-900 mb-2">~100 Days Delay</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Traditional relief pipelines take an average of 100 days to disburse funds to affected communities, arriving long after displacement and initial emergency costs have accumulated.
                </p>
              </div>

              <div className="p-5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-xs font-mono text-emerald-700 font-bold mb-2">GRASSROOTS REALITY</div>
                <h3 className="font-semibold text-slate-900 mb-2">P2P Account Freezes</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Grassroots mutual aid volunteers frequently suffer personal account limits and manual intake burnout. Landfall scales transparently on PayPal Sandbox Payouts batches.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-slate-900 text-slate-400 py-8 text-xs">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-white">Landfall</span> — Built for the PayPal AI Hackathon 2026. MIT Licensed.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/docs/PROJECT_BRIEF.md" className="hover:text-white transition">
              Brief
            </Link>
            <Link href="https://github.com/Bharathadi01/landfall" className="hover:text-white transition" target="_blank">
              GitHub
            </Link>
            <Link href="/spike" className="hover:text-white transition">
              PayPal Spike
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

