import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GROQ_FREE_MODEL,
  FREE_MODEL_ALLOWLIST,
  validateModelName,
  executeServerTool,
  executeGroqWatchOfficerSession,
  GroqProviderError,
  READ_ONLY_TOOL_ALLOWLIST,
} from "@/lib/ai/watch-officer/groq-client";
import { runWatchOfficerAnalysis } from "@/lib/ai/watch-officer/orchestrator";
import { WatchOfficerResponseSchema } from "@/lib/ai/watch-officer/schema";
import type { WatchOfficerContext } from "@/lib/ai/watch-officer/types";
import { db } from "@/lib/db/client";
import { funds } from "@/lib/db/schema";
import fs from "fs";
import path from "path";

describe.skipIf(!process.env.LANDFALL_DB_TESTS)("Groq Free Plan AI Provider & Zero-Cost Architecture (§1, §2, §5, §7)", () => {
  let testFundId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const existing = await db.select().from(funds).limit(1);
    if (existing.length > 0) {
      testFundId = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(funds)
        .values({
          name: "Tampa Relief Fund",
          paypalMerchantEmail: "sb-7sfg953788004@business.example.com",
        })
        .returning();
      testFundId = inserted.id;
    }
  });

  const sampleValidStructuredOutput = {
    summary: "Watch Officer operational briefing. Allocatable balance is $800.00 under CONSTRAINED status.",
    eventContext: {
      hasActiveDisaster: true,
      eventName: "Hurricane Milton",
      eventKey: "TBW:HU.W:0009",
      severity: "Extreme",
      mode: "LIVE",
      isTranche1Eligible: true,
    },
    financialReadiness: {
      state: "CONSTRAINED",
      reason: "Available cash is positive but leaves a funding gap.",
      coveragePercentage: 78,
      isFullyFunded: false,
      isConstrained: true,
      evidenceId: "ev_treasury_001",
    },
    fundingConstraints: {
      currency: "USD",
      allocatableFormatted: "$800.00",
      requiredFundingFormatted: "$1,022.50",
      fundingGapFormatted: "$222.50",
      contingentPledgesFormatted: "$2,500.00",
      reserveProtectedFormatted: "$500.00",
      isConstrained: true,
    },
    exposureSummary: {
      totalHouseholds: 10,
      confirmedExposureCount: 8,
      outOfAreaCount: 1,
      needsReviewCount: 1,
      displacedCount: 2,
    },
    operationalBlockers: [
      "Funding gap of $222.50 prevents full coverage for all 10 households.",
    ],
    keyFindings: [
      {
        finding: "Allocatable cash is $800.00.",
        evidenceId: "ev_treasury_001",
        category: "TREASURY",
      },
    ],
    scenarioComparisons: [
      {
        scenarioId: "BASELINE",
        title: "Standard Tranche 1",
        allocatableFormatted: "$800.00",
        coveragePercentage: 78,
        fundedHouseholdsCount: 7,
        readinessState: "CONSTRAINED",
        tradeoffSummary: "Funds 7 of 10 households with baseline operating reserves intact.",
      },
    ],
    recommendedHumanActions: [
      {
        role: "coordinator",
        priority: "HIGH",
        action: "Review waitlisted tier recipients",
        reason: "Allocatable cash does not fully fund tier 6 general relief.",
      },
    ],
    evidenceReferences: [
      {
        evidenceId: "ev_treasury_001",
        source: "TREASURY",
        retrievedAt: new Date().toISOString(),
        status: "VERIFIED",
        summary: "Liquid allocatable: $800.00",
      },
    ],
    warnings: [],
    dataFreshness: {
      isStale: false,
      lastSyncAt: new Date().toISOString(),
      source: "NWS_LIVE",
    },
    generatedAt: new Date().toISOString(),
  };

  // Test 1: Groq API Success (Two-stage flow)
  it("1. Groq API success: executes Stage A and Stage B using openai/gpt-oss-20b", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            // Stage A: Model requests get_treasury_snapshot
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "get_treasury_snapshot",
                          arguments: "{}",
                        },
                      },
                    ],
                  },
                },
              ],
            })
            // Stage A (continuation): Model finishes tool calling
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "Gathered treasury evidence. Ready for synthesis.",
                  },
                },
              ],
            })
            // Stage B: Structured Output Synthesis
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: JSON.stringify(sampleValidStructuredOutput),
                  },
                },
              ],
            }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
      query: "Check our treasury snapshot and funding constraints.",
    };

    const session = await executeGroqWatchOfficerSession({
      context: ctx,
      apiKey: "gsk_mock_test_key",
      model: "openai/gpt-oss-20b",
      groqClient: mockGroqClient,
    });

    expect(session.modelUsed).toBe("groq/openai/gpt-oss-20b");
    expect(session.executedTools).toContain("get_treasury_snapshot");
    expect(session.rawAnalysis.financialReadiness.state).toBe("CONSTRAINED");
    expect(WatchOfficerResponseSchema.safeParse(session.rawAnalysis).success).toBe(true);
  });

  // Test 2: Tool calling
  it("2. Tool calling: dispatches model request to server-side read-only tool", async () => {
    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
      query: "Inspect disaster alert",
    };

    const result = await executeServerTool("get_disaster_context", "{}", ctx);
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    // stable (not time-based) so ids the model saw in Stage A still match the server's integrity check
    expect(result.evidenceId).toBe("ev_disaster");
  });

  // Test 3: Multiple sequential tool calls
  it("3. Multiple sequential tool calls: executes multiple tools across loop iterations", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            // Step 1: Call disaster context
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    tool_calls: [
                      {
                        id: "call_disaster",
                        type: "function",
                        function: { name: "get_disaster_context", arguments: "{}" },
                      },
                    ],
                  },
                },
              ],
            })
            // Step 2: Call exposure summary
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    tool_calls: [
                      {
                        id: "call_exposure",
                        type: "function",
                        function: { name: "get_exposure_summary", arguments: "{}" },
                      },
                    ],
                  },
                },
              ],
            })
            // Step 3: Finish tool calls
            .mockResolvedValueOnce({
              choices: [{ message: { role: "assistant", content: "Evidence gathered." } }],
            })
            // Stage B: Structured response
            .mockResolvedValueOnce({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: JSON.stringify(sampleValidStructuredOutput),
                  },
                },
              ],
            }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
      query: "Full review",
    };

    const session = await executeGroqWatchOfficerSession({
      context: ctx,
      apiKey: "gsk_mock_test_key",
      model: "openai/gpt-oss-20b",
      groqClient: mockGroqClient,
    });

    expect(session.executedTools).toContain("get_disaster_context");
    expect(session.executedTools).toContain("get_exposure_summary");
    expect(mockGroqClient.chat.completions.create).toHaveBeenCalledTimes(4);
  });

  // Test 4: Tool allowlist enforcement
  it("4. Tool allowlist enforcement: rejects unauthorized or dangerous tool calls", async () => {
    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "malicious_actor",
      actorRole: "coordinator",
    };

    const forbiddenTools = [
      "send_paypal_payout",
      "charge_vault_pledge",
      "execute_shell",
      "drop_tables",
      "transfer_funds",
    ];

    for (const tool of forbiddenTools) {
      const res = await executeServerTool(tool, "{}", ctx);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Security violation");
    }
  });

  // Test 5: Malformed tool arguments
  it("5. Malformed tool arguments: safely handles unparseable JSON arguments", async () => {
    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const res = await executeServerTool("get_treasury_snapshot", "{ invalid JSON: ", ctx);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Malformed arguments");
  });

  // Test 6: Invalid model output
  it("6. Invalid model output: throws GroqProviderError when model produces unparseable JSON", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              choices: [{ message: { role: "assistant", content: "Ready." } }],
            })
            // Stage B returns corrupt JSON
            .mockResolvedValueOnce({
              choices: [{ message: { role: "assistant", content: "INVALID_NOT_JSON" } }],
            }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    await expect(
      executeGroqWatchOfficerSession({
        context: ctx,
        apiKey: "gsk_mock_test_key",
        model: "openai/gpt-oss-20b",
        groqClient: mockGroqClient,
      })
    ).rejects.toThrowError(GroqProviderError);
  });

  // Test 7: Number-integrity enforcement
  it("7. Number-integrity enforcement: server overrides hallucinated model figures", async () => {
    const hallucinatedOutput = {
      ...sampleValidStructuredOutput,
      fundingConstraints: {
        ...sampleValidStructuredOutput.fundingConstraints,
        allocatableFormatted: "$999,999.00", // Fabricated!
      },
    };

    const mockGroqClient = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              choices: [{ message: { role: "assistant", content: "Done." } }],
            })
            .mockResolvedValueOnce({
              choices: [{ message: { role: "assistant", content: JSON.stringify(hallucinatedOutput) } }],
            }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const { analysis } = await runWatchOfficerAnalysis({
      context: ctx,
      useLiveModel: true,
      groqClient: mockGroqClient,
    });

    // Authoritative number must be enforced by server
    expect(analysis.fundingConstraints.allocatableFormatted).not.toBe("$999,999.00");
  });

  // Test 8: Missing GROQ_API_KEY
  it("8. Missing GROQ_API_KEY: automatically falls back to deterministic template", async () => {
    const originalKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      const ctx: WatchOfficerContext = {
        fundId: testFundId,
        fundName: "Tampa Relief Fund",
        actorId: "coord_1",
        actorRole: "coordinator",
      };

      const { analysis, modelUsed } = await runWatchOfficerAnalysis({
        context: ctx,
        useLiveModel: true, // requested live, but key missing
      });

      expect(modelUsed).toContain("OFFLINE_FALLBACK");
      expect(WatchOfficerResponseSchema.safeParse(analysis).success).toBe(true);
      expect(analysis.warnings.some((w) => w.includes("OFFLINE_FALLBACK"))).toBe(true);
    } finally {
      process.env.GROQ_API_KEY = originalKey;
    }
  });

  // Test 9: HTTP 429 rate limiting
  it("9. HTTP 429 rate limiting: halts remote inference and activates offline fallback", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue({
            status: 429,
            message: "Rate limit reached for model openai/gpt-oss-20b on free tier.",
          }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const { analysis, modelUsed } = await runWatchOfficerAnalysis({
      context: ctx,
      useLiveModel: true,
      groqClient: mockGroqClient,
    });

    expect(modelUsed).toContain("OFFLINE_FALLBACK");
    expect(analysis.warnings.some((w) => w.includes("OFFLINE_FALLBACK"))).toBe(true);
  });

  // Test 10: Provider timeout
  it("10. Provider timeout: activates offline fallback when request exceeds threshold", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue({
            name: "AbortError",
            message: "Request timed out after 15000ms.",
          }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const { analysis, modelUsed } = await runWatchOfficerAnalysis({
      context: ctx,
      useLiveModel: true,
      groqClient: mockGroqClient,
    });

    expect(modelUsed).toContain("OFFLINE_FALLBACK");
  });

  // Test 11: Provider unavailable (HTTP 503)
  it("11. Provider unavailable: activates offline fallback on HTTP 503 without crashing", async () => {
    const mockGroqClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue({
            status: 503,
            message: "Service Unavailable",
          }),
        },
      },
    };

    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const { analysis, modelUsed } = await runWatchOfficerAnalysis({
      context: ctx,
      useLiveModel: true,
      groqClient: mockGroqClient,
    });

    expect(modelUsed).toContain("OFFLINE_FALLBACK");
  });

  // Test 12: Offline fallback
  it("12. Offline fallback: useLiveModel=false executes 100% deterministic template without network", async () => {
    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
      query: "Provide operational briefing",
    };

    const { analysis, modelUsed } = await runWatchOfficerAnalysis({
      context: ctx,
      useLiveModel: false,
    });

    expect(modelUsed).toContain("OFFLINE_FALLBACK");
    expect(WatchOfficerResponseSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.operationalBlockers.length).toBeGreaterThanOrEqual(0);
  });

  // Test 13: No OpenAI network calls
  it("13. No OpenAI network calls: codebase contains zero references to OpenAI endpoints or SDK", () => {
    const watchOfficerDir = path.resolve(__dirname, "../../lib/ai/watch-officer");
    const files = fs.readdirSync(watchOfficerDir);

    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const content = fs.readFileSync(path.join(watchOfficerDir, file), "utf8");

      expect(content).not.toContain("api.openai.com");
      expect(content).not.toContain("@ai-sdk/openai");
      expect(content).not.toContain("OPENAI_API_KEY");
    }
  });

  // Test 14: No automatic paid-provider fallback
  it("14. No automatic paid-provider fallback: strictly rejects non-free model identifiers", () => {
    const forbiddenModels = [
      "gpt-4o",
      "claude-3-5-sonnet",
      "gemini-1.5-pro",
      "cerebras/llama-3.1-70b",
      "openrouter/auto",
    ];

    for (const m of forbiddenModels) {
      expect(() => validateModelName(m)).toThrowError(/ZERO_COST_VIOLATION/);
    }

    // Free model must pass
    expect(validateModelName("openai/gpt-oss-20b")).toBe("openai/gpt-oss-20b");
  });

  // Test 15: PII exclusion from model context
  it("15. PII exclusion from model context: tool outputs never include names, addresses, or emails", async () => {
    const ctx: WatchOfficerContext = {
      fundId: testFundId,
      fundName: "Tampa Relief Fund",
      actorId: "coord_1",
      actorRole: "coordinator",
    };

    const exposureTool = await executeServerTool("get_exposure_summary", "{}", ctx);
    const serialized = JSON.stringify(exposureTool.result);

    // Verify absence of sensitive PII fields
    expect(serialized).not.toContain("residentName");
    expect(serialized).not.toContain("streetAddress");
    expect(serialized).not.toContain("phoneNumber");
    expect(serialized).not.toContain("paypalEmail");
  });

  // Test 16: Financial execution remains inaccessible
  it("16. Financial execution remains inaccessible: Watch Officer tools contain zero payment actions", () => {
    // All permitted tools are strictly read-only inspection or scenario comparison
    for (const tool of READ_ONLY_TOOL_ALLOWLIST) {
      expect(tool.startsWith("get_") || tool.startsWith("compare_")).toBe(true);
      expect(tool).not.toMatch(/send|charge|capture|transfer|initiate_payout|create_payout/i);
    }
  });
});
