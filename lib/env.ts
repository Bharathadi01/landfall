import { z } from "zod";

const envSchema = z.object({
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().min(1, "PAYPAL_CLIENT_ID is required"),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(""),
  PAYPAL_WEBHOOK_ID: z.string().optional().default(""),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1, "NEXT_PUBLIC_PAYPAL_CLIENT_ID is required"),
  PAYPAL_LIPP_REDIRECT: z.string().url().default("http://127.0.0.1:3000/api/auth/paypal/callback"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/landfall"),
  GROQ_API_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_AG_STUDIO_LICENSE: z.string().optional(),
  NEXT_PUBLIC_AG_GRID_LICENSE: z.string().optional(),
  NWS_USER_AGENT: z.string().default("Landfall hackathon app (contact: contact@landfall.local)"),
  CRON_SECRET: z.string().optional(), // no default: cron routes fail closed when unset
  JUDGE_MODE_ENABLED: z.string().transform((v) => v === "true").default("true"),
  APP_URL: z.string().url().default("http://127.0.0.1:3000"),
  SANDBOX_RESIDENT_EMAIL: z.string().optional(),
  WATCH_OFFICER_MODEL: z
    .string()
    .default("openai/gpt-oss-20b")
    .refine((val) => val === "openai/gpt-oss-20b", {
      message: "WATCH_OFFICER_MODEL must be 'openai/gpt-oss-20b' (Groq Free Plan zero-cost invariant)",
    }),
});

export const env = envSchema.parse({
  PAYPAL_ENV: process.env.PAYPAL_ENV,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_LIPP_REDIRECT: process.env.PAYPAL_LIPP_REDIRECT,
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  NEXT_PUBLIC_AG_STUDIO_LICENSE: process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE,
  NEXT_PUBLIC_AG_GRID_LICENSE: process.env.NEXT_PUBLIC_AG_GRID_LICENSE,
  NWS_USER_AGENT: process.env.NWS_USER_AGENT,
  CRON_SECRET: process.env.CRON_SECRET,
  JUDGE_MODE_ENABLED: process.env.JUDGE_MODE_ENABLED,
  APP_URL: process.env.APP_URL,
  SANDBOX_RESIDENT_EMAIL: process.env.SANDBOX_RESIDENT_EMAIL,
  WATCH_OFFICER_MODEL: process.env.WATCH_OFFICER_MODEL,
});
