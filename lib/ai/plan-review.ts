/**
 * PLAN REVIEW AGENT (§8, Phase 4)
 * AI Responsibilities:
 * - Audits proposed immutable payout plans against policy rules and verified facts.
 * - Identifies policy inconsistencies, evidence gaps, duplicate address clusters, and solvency margins.
 * - Returns structured findings for human coordinator inspection.
 *
 * Strict Invariants:
 * 1. Read-only audit: CANNOT approve, alter, or execute any payout plan.
 * 2. Any uncertainty or anomaly FAILS into mandatory human coordinator review.
 * 3. Zero-cost AI: Groq Free Plan 'openai/gpt-oss-20b' with deterministic offline fallback.
 * 4. Zero access to PayPal payout or money-moving APIs.
 */

import { z } from "zod";
import Groq from "groq-sdk";
import { GROQ_FREE_MODEL } from "./watch-officer/groq-client";
import type { HouseholdProfile, PolicyConfig } from "@/lib/rules/engine";

export const AuditFindingItemSchema = z.object({
  code: z.enum([
    "TIER_MISMATCH",
    "MISSING_DOCUMENTS",
    "SOLVENCY_MARGIN_EXCEEDED",
    "DUPLICATE_ADDRESS_CLUSTER",
    "UNVERIFIED_COORDINATES",
    "EXCESSIVE_GRANT_REQUEST",
    "PROMPT_INJECTION_FLAGGED",
    "GENERAL_ANOMALY",
  ]),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  affectedHouseholdId: z.string().optional(),
  explanation: z.string(),
  policyRuleViolated: z.string().optional(),
});

export const PlanReviewVerdictSchema = z.object({
  auditId: z.string(),
  planHash: z.string(),
  verdict: z.enum(["AUDIT_CLEARED", "POLICY_ANOMALY_DETECTED", "NEEDS_HUMAN_INSPECTION"]),
  solvencyMarginCents: z.number(),
  anomaliesFoundCount: z.number(),
  findings: z.array(AuditFindingItemSchema),
  humanReviewRequired: z.boolean(),
  modelUsed: z.string(),
  auditedAt: z.string(),
});

export type AuditFindingItem = z.infer<typeof AuditFindingItemSchema>;
export type PlanReviewVerdict = z.infer<typeof PlanReviewVerdictSchema>;

export interface PlanReviewInput {
  planHash: string;
  households: HouseholdProfile[];
  fundedHouseholdIds: string[];
  allocatableCents: number;
  totalProposedCents: number;
  config: PolicyConfig;
  notes?: string;
}

/**
 * Deterministic offline rule checker that validates plans even when remote AI is offline.
 */
export function runDeterministicPlanAudit(input: PlanReviewInput): PlanReviewVerdict {
  const auditedAt = new Date().toISOString();
  const findings: AuditFindingItem[] = [];

  // 1. Solvency Margin Check (Pure deterministic arithmetic)
  const solvencyMarginCents = input.allocatableCents - input.totalProposedCents;
  if (solvencyMarginCents < 0) {
    findings.push({
      code: "SOLVENCY_MARGIN_EXCEEDED",
      severity: "CRITICAL",
      explanation: `Total proposed disbursement ($${(input.totalProposedCents / 100).toFixed(2)}) exceeds net allocatable cash ($${(input.allocatableCents / 100).toFixed(2)}) by $${(Math.abs(solvencyMarginCents) / 100).toFixed(2)}.`,
      policyRuleViolated: "Rule §4.2: Treasury Solvency Invariant",
    });
  }

  // 2. Household verification check for funded households
  const fundedSet = new Set(input.fundedHouseholdIds);
  for (const hh of input.households) {
    if (fundedSet.has(hh.id)) {
      if (hh.hasMissingDocs) {
        findings.push({
          code: "MISSING_DOCUMENTS",
          severity: "CRITICAL",
          affectedHouseholdId: hh.id,
          explanation: `Household ${hh.id} is slated for disbursement but has missing or unverified proof documentation.`,
          policyRuleViolated: "Rule §4.1: Evidence Verification Level Requirement",
        });
      }
      if (!hh.isExposureConfirmed) {
        findings.push({
          code: "UNVERIFIED_COORDINATES",
          severity: "CRITICAL",
          affectedHouseholdId: hh.id,
          explanation: `Household ${hh.id} is slated for disbursement but lacks confirmed exposure within official hazard polygon.`,
          policyRuleViolated: "Rule §4.3: Sentinel Geographic Invariant",
        });
      }
    }
  }

  // 3. Duplicate address cluster check
  const addressCounts = new Map<string, number>();
  for (const hh of input.households) {
    if (fundedSet.has(hh.id)) {
      const normAddr = hh.address.trim().toLowerCase();
      addressCounts.set(normAddr, (addressCounts.get(normAddr) || 0) + 1);
      if ((addressCounts.get(normAddr) || 0) > input.config.maxHouseholdsPerAddress) {
        findings.push({
          code: "DUPLICATE_ADDRESS_CLUSTER",
          severity: "WARNING",
          affectedHouseholdId: hh.id,
          explanation: `Address '${hh.address}' exceeds maximum allowed households (${input.config.maxHouseholdsPerAddress}). Possible duplicate claim.`,
          policyRuleViolated: "Rule §4.4: Anti-Fraud Address Cap Invariant",
        });
      }
    }
  }

  // 4. Prompt injection defense in notes or freeform fields
  if (input.notes) {
    const suspiciousPatterns = [/ignore\s+previous/i, /bypass\s+approval/i, /grant\s+all/i, /admin\s+override/i];
    for (const pat of suspiciousPatterns) {
      if (pat.test(input.notes)) {
        findings.push({
          code: "PROMPT_INJECTION_FLAGGED",
          severity: "CRITICAL",
          explanation: `Potentially hostile prompt injection attempt detected in input notes. Audit immediately escalated to human security review.`,
          policyRuleViolated: "Invariant: Prompt Injection Resistance",
        });
      }
    }
  }

  const criticalFindings = findings.filter((f) => f.severity === "CRITICAL");
  const verdict: "AUDIT_CLEARED" | "POLICY_ANOMALY_DETECTED" | "NEEDS_HUMAN_INSPECTION" =
    criticalFindings.length > 0
      ? "POLICY_ANOMALY_DETECTED"
      : findings.length > 0
      ? "NEEDS_HUMAN_INSPECTION"
      : "AUDIT_CLEARED";

  return {
    auditId: `audit_det_${Date.now()}`,
    planHash: input.planHash,
    verdict,
    solvencyMarginCents,
    anomaliesFoundCount: findings.length,
    findings,
    humanReviewRequired: findings.length > 0,
    modelUsed: "deterministic-rule-auditor",
    auditedAt,
  };
}

/**
 * Executes structured plan review using Groq Free Plan or deterministic offline fallback.
 */
export async function auditPayoutPlanWithAI(input: PlanReviewInput): Promise<PlanReviewVerdict> {
  const deterministicVerdict = runDeterministicPlanAudit(input);
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return deterministicVerdict;
  }

  try {
    const groq = new Groq({ apiKey });

    const prompt = `You are the Landfall Plan Review Agent.
Audit this proposed payout plan against policy rules and find any anomalies or inconsistencies.
DO NOT approve the plan or authorize payments.

PROPOSED PLAN CONTEXT:
Plan Hash: ${input.planHash}
Total Funded Households: ${input.fundedHouseholdIds.length}
Total Proposed Disbursement: $${(input.totalProposedCents / 100).toFixed(2)}
Net Allocatable Cash: $${(input.allocatableCents / 100).toFixed(2)}
Solvency Margin: $${((input.allocatableCents - input.totalProposedCents) / 100).toFixed(2)}
Households: ${JSON.stringify(
      input.households.map((h) => ({
        id: h.id,
        address: h.address,
        isExposureConfirmed: h.isExposureConfirmed,
        hasMissingDocs: h.hasMissingDocs,
        isFunded: input.fundedHouseholdIds.includes(h.id),
      }))
    )}

Deterministic Pre-Check Findings: ${JSON.stringify(deterministicVerdict.findings)}

Respond ONLY with a valid JSON matching this schema:
{
  "auditId": "audit_...",
  "planHash": "${input.planHash}",
  "verdict": "AUDIT_CLEARED" | "POLICY_ANOMALY_DETECTED" | "NEEDS_HUMAN_INSPECTION",
  "solvencyMarginCents": number,
  "anomaliesFoundCount": number,
  "findings": [
    {
      "code": "TIER_MISMATCH" | "MISSING_DOCUMENTS" | "SOLVENCY_MARGIN_EXCEEDED" | "DUPLICATE_ADDRESS_CLUSTER" | "UNVERIFIED_COORDINATES" | "EXCESSIVE_GRANT_REQUEST" | "PROMPT_INJECTION_FLAGGED" | "GENERAL_ANOMALY",
      "severity": "CRITICAL" | "WARNING" | "INFO",
      "affectedHouseholdId": string,
      "explanation": string,
      "policyRuleViolated": string
    }
  ],
  "humanReviewRequired": boolean
}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_FREE_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an independent humanitarian auditor. You flag anomalies. Respond in strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    // Merge deterministic findings with AI findings to guarantee zero false negative on critical policy invariants
    const mergedFindings = [...deterministicVerdict.findings];
    if (Array.isArray(parsed.findings)) {
      for (const f of parsed.findings) {
        if (!mergedFindings.some((existing) => existing.code === f.code && existing.affectedHouseholdId === f.affectedHouseholdId)) {
          mergedFindings.push(f);
        }
      }
    }

    const hasCritical = mergedFindings.some((f) => f.severity === "CRITICAL");
    const finalVerdict = hasCritical
      ? "POLICY_ANOMALY_DETECTED"
      : mergedFindings.length > 0
      ? "NEEDS_HUMAN_INSPECTION"
      : "AUDIT_CLEARED";

    return PlanReviewVerdictSchema.parse({
      auditId: parsed.auditId || `audit_${Date.now()}`,
      planHash: input.planHash,
      verdict: finalVerdict,
      solvencyMarginCents: deterministicVerdict.solvencyMarginCents,
      anomaliesFoundCount: mergedFindings.length,
      findings: mergedFindings,
      humanReviewRequired: mergedFindings.length > 0,
      modelUsed: GROQ_FREE_MODEL,
      auditedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[PLAN_REVIEW_AGENT] Groq inference unavailable, using deterministic fallback:", err);
    return deterministicVerdict;
  }
}

