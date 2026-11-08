import { z } from "zod";

const envSchema = z.object({
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().min(1, "PAYPAL_CLIENT_ID is required"),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(""),
  PAYPAL_WEBHOOK_ID: z.string().optional().default(""),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1, "NEXT_PUBLIC_PAYPAL_CLIENT_ID is required"),
  PAYPAL_LIPP_REDIRECT: z.string().url().default("http://127.0.0.1:3000/api/auth/paypal/callback"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/landfall"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional(),
  MODEL_FAST: z.string().default("gemini-1.5-flash"),
  MODEL_SMART: z.string().default("gemini-1.5-pro"),
  MODEL_AUDITOR: z.string().default("claude-3-5-sonnet-20241022"),
  NEXT_PUBLIC_AG_STUDIO_LICENSE: z.string().optional(),
  NWS_USER_AGENT: z.string().default("Landfall hackathon app (contact: contact@landfall.local)"),
  CRON_SECRET: z.string().default("dev-cron-secret"),
  JUDGE_MODE_ENABLED: z.string().transform((v) => v === "true").default("true"),
  APP_URL: z.string().url().default("http://127.0.0.1:3000"),
});

export const env = envSchema.parse({
  PAYPAL_ENV: process.env.PAYPAL_ENV,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_LIPP_REDIRECT: process.env.PAYPAL_LIPP_REDIRECT,
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  MODEL_FAST: process.env.MODEL_FAST,
  MODEL_SMART: process.env.MODEL_SMART,
  MODEL_AUDITOR: process.env.MODEL_AUDITOR,
  NEXT_PUBLIC_AG_STUDIO_LICENSE: process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE,
  NWS_USER_AGENT: process.env.NWS_USER_AGENT,
  CRON_SECRET: process.env.CRON_SECRET,
  JUDGE_MODE_ENABLED: process.env.JUDGE_MODE_ENABLED,
  APP_URL: process.env.APP_URL,
});

