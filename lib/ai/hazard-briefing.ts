/**
 * HAZARD BRIEFING AGENT (§8, Phase 4)
 * AI Responsibilities:
 * - Reads validated NWS alerts and NHC cyclone data.
 * - Produces structured operational incident briefings with source citations.
 * - Explains meteorological trajectory and changing coastal conditions.
 *
 * Strict Invariants:
 * 1. Read-only intelligence: CANNOT trigger event activations.
 * 2. Spatial boundary: CANNOT decide geographic household exposure (Turf.js only).
 * 3. Zero-cost AI: Groq Free Plan 'openai/gpt-oss-20b' with deterministic offline template fallback.
 * 4. Zero money movement or financial permissions.
 */

import { z } from "zod";
import type { UnifiedWeatherIntelligence } from "@/lib/sentinel/weather-client";
import Groq from "groq-sdk";
import { GROQ_FREE_MODEL } from "./watch-officer/groq-client";

export const HazardBriefingSchema = z.object({
  briefingId: z.string(),
  headline: z.string(),
  synopsis: z.string(),
  changingConditions: z.array(z.string()),
  threats: z.object({
    surgeRisk: z.enum(["EXTREME", "HIGH", "MODERATE", "LOW", "NONE"]),
    windRisk: z.enum(["EXTREME", "HIGH", "MODERATE", "LOW", "NONE"]),
    floodRisk: z.enum(["EXTREME", "HIGH", "MODERATE", "LOW", "NONE"]),
  }),
  sourceCitations: z.array(
    z.object({
      sourceName: z.string(),
      url: z.string(),
      retrievalTime: z.string(),
    })
  ),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  operationalNotes: z.array(z.string()),
  modelUsed: z.string(),
  generatedAt: z.string(),
});

export type HazardBriefing = z.infer<typeof HazardBriefingSchema>;

/**
 * Deterministic offline briefing template in case Groq is rate-limited or unavailable ($0 cost guarantee).
 */
export function buildDeterministicHazardBriefing(
  weather: UnifiedWeatherIntelligence
): HazardBriefing {
  const generatedAt = new Date().toISOString();
  const activeWarning = weather.nwsAlerts.find(
    (a) => a.significance === "W" || a.isTranche1Eligible
  );

  const activeStormName = weather.nhcStorms?.[0]?.name;
  const headline =
    weather.state === "REPLAY" && activeStormName
      ? `Hurricane ${activeStormName} Active: ${activeWarning?.event || "Severe Weather"} for ${weather.selectedFund.name}`
      : activeWarning
      ? `${activeWarning.event} Active for ${weather.selectedFund.name} (${activeWarning.office})`
      : weather.hasActiveAtlanticCyclone
      ? `Active Atlantic System Monitored: ${weather.atlanticStatusMessage}`
      : `Quiet Meteorological Conditions for ${weather.selectedFund.name} (No Active Cyclone)`;

  const changingConditions: string[] = [];
  if (weather.stationObservation) {
    const obs = weather.stationObservation;
    changingConditions.push(
      `Surface observation at ${obs.stationId}: ${obs.description}, ${
        obs.temperatureC !== null ? obs.temperatureC.toFixed(1) + "°C" : "N/A"
      }, wind ${obs.windSpeedKmh ?? 0} km/h (barometer: ${
        obs.barometricPressurePa ? (obs.barometricPressurePa / 100).toFixed(1) + " hPa" : "N/A"
      }).`
    );
  }
  if (weather.forecastPeriods.length > 0) {
    const nextPeriod = weather.forecastPeriods[0];
    changingConditions.push(
      `Next 6-12h forecast: ${nextPeriod.shortForecast}, wind ${nextPeriod.windSpeed} ${nextPeriod.windDirection}.`
    );
  }
  if (changingConditions.length === 0) {
    changingConditions.push("No significant atmospheric changes reported by nearest NWS observation station.");
  }

  const isExtreme = activeWarning?.severity === "Extreme";
  const isSevere = activeWarning?.severity === "Severe";

  return {
    briefingId: `briefing_det_${Date.now()}`,
    headline,
    synopsis: activeWarning
      ? activeWarning.headline || activeWarning.areaDesc
      : weather.atlanticStatusMessage,
    changingConditions,
    threats: {
      surgeRisk: isExtreme ? "EXTREME" : isSevere ? "HIGH" : "LOW",
      windRisk: isExtreme ? "EXTREME" : isSevere ? "HIGH" : "LOW",
      floodRisk: activeWarning?.phenomena === "FF" ? "HIGH" : "MODERATE",
    },
    sourceCitations: [
      {
        sourceName: "National Weather Service (api.weather.gov)",
        url: "https://api.weather.gov",
        retrievalTime: weather.sourcePublicationTime || generatedAt,
      },
      {
        sourceName: "National Hurricane Center (nhc.noaa.gov)",
        url: "https://www.nhc.noaa.gov",
        retrievalTime: generatedAt,
      },
      {
        sourceName: "NOAA nowCOAST WMS (nowcoast.noaa.gov)",
        url: "https://nowcoast.noaa.gov",
        retrievalTime: generatedAt,
      },
    ],
    confidenceLevel: "HIGH",
    operationalNotes: [
      "Sentinel deterministic exposure evaluation remains active.",
      "Watches and advisories do not trigger Tranche 1 disbursements.",
      "Dual-human passkey authorization is mandatory before any relief payout.",
    ],
    modelUsed: "deterministic-offline-fallback",
    generatedAt,
  };
}

/**
 * Generates an operational hazard briefing using Groq Free Plan or deterministic fallback.
 */
export async function generateHazardBriefing(
  weather: UnifiedWeatherIntelligence
): Promise<HazardBriefing> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return buildDeterministicHazardBriefing(weather);
  }

  try {
    const groq = new Groq({ apiKey });

    const prompt = `You are the Landfall Hazard Briefing Agent.
Analyze this official US government weather feed and return a concise, factual incident briefing.
DO NOT invent fictional storms. Ground every observation strictly in the provided data.

DATA:
Fund: ${weather.selectedFund.name} (${weather.selectedFund.wfo})
System State: ${weather.state}
NWS Active Warnings: ${weather.nwsAlerts.length}
Tranche 1 Trigger Alerts: ${weather.tranche1AlertsCount}
Atlantic Cyclone Status: ${weather.atlanticStatusMessage}
Station Observation: ${JSON.stringify(weather.stationObservation || {})}
Forecast: ${JSON.stringify(weather.forecastPeriods.slice(0, 3))}

Respond ONLY with a valid JSON object matching this schema:
{
  "briefingId": "briefing_...",
  "headline": string,
  "synopsis": string,
  "changingConditions": string[],
  "threats": {
    "surgeRisk": "EXTREME" | "HIGH" | "MODERATE" | "LOW" | "NONE",
    "windRisk": "EXTREME" | "HIGH" | "MODERATE" | "LOW" | "NONE",
    "floodRisk": "EXTREME" | "HIGH" | "MODERATE" | "LOW" | "NONE"
  },
  "sourceCitations": [{"sourceName": string, "url": string, "retrievalTime": string}],
  "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
  "operationalNotes": string[]
}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_FREE_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a professional humanitarian meteorologist. Respond in strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    });

    const rawText = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawText);

    return HazardBriefingSchema.parse({
      ...parsed,
      briefingId: parsed.briefingId || `briefing_${Date.now()}`,
      modelUsed: GROQ_FREE_MODEL,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[HAZARD_BRIEFING_AGENT] Groq inference unavailable, using deterministic fallback:", err);
    return buildDeterministicHazardBriefing(weather);
  }
}

