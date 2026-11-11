import { runWatchOfficerAnalysis } from "@/lib/ai/watch-officer/orchestrator";
runWatchOfficerAnalysis({ context: { fundId: "00000000-0000-0000-0000-000000000001", fundName: "Smoke fund", actorId: "smoke", actorRole: "coordinator", query: "Can we afford tranche 1 and what blocks approval?" } as never, useLiveModel: true })
  .then((r) => console.log(JSON.stringify({ model: r.modelUsed, ms: r.latencyMs, warnings: r.analysis.warnings, findings: r.analysis.keyFindings.length, summary: r.analysis.summary.slice(0, 200) }, null, 1)))
  .catch((e) => console.error("ERR", e?.message))
  .finally(() => process.exit(0));
