import { pgTable, text, timestamp, boolean, doublePrecision, integer, jsonb, uuid } from "drizzle-orm/pg-core";

export const funds = pgTable("funds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  serviceAreaGeojson: jsonb("service_area_geojson"),
  paypalMerchantEmail: text("paypal_merchant_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  plainText: text("plain_text").notNull(),
  rulesJson: jsonb("rules_json").notNull(),
  confirmedBy: text("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),
});

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  status: text("status", { enum: ["draft", "verified", "needs_review", "rejected"] }).default("draft").notNull(),
  caseJson: jsonb("case_json").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  language: text("language").default("en").notNull(),
  wallet: text("wallet", { enum: ["PAYPAL", "VENMO"] }).default("PAYPAL").notNull(),
  receiver: text("receiver").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const identityLinks = pgTable("identity_links", {
  householdId: uuid("household_id").references(() => households.id).primaryKey(),
  paypalUserId: text("paypal_user_id"),
  payerId: text("payer_id"),
  emailHash: text("email_hash").notNull(),
  verifiedAccount: boolean("verified_account").default(false).notNull(),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  readJson: jsonb("read_json").notNull(),
  imageDeletedAt: timestamp("image_deleted_at"),
});

export const riskReports = pgTable("risk_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  reportJson: jsonb("report_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  nwsId: text("nws_id").unique().notNull(),
  event: text("event").notNull(),
  severity: text("severity").notNull(),
  rawJson: jsonb("raw_json").notNull(),
  geometryGeojson: jsonb("geometry_geojson"),
  onset: timestamp("onset"),
  expires: timestamp("expires"),
  source: text("source", { enum: ["live", "replay"] }).default("live").notNull(),
});

export const activations = pgTable("activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  alertId: uuid("alert_id").references(() => alerts.id).notNull(),
  activationJson: jsonb("activation_json").notNull(),
  status: text("status", { enum: ["open", "planned", "audited", "approved", "paid", "closed"] }).default("open").notNull(),
});

export const payoutPlans = pgTable("payout_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  activationId: uuid("activation_id").references(() => activations.id).notNull(),
  planJson: jsonb("plan_json").notNull(),
  planHash: text("plan_hash").notNull(),
  rulesVersion: text("rules_version").notNull(),
  status: text("status").default("draft").notNull(),
});

export const auditVerdicts = pgTable("audit_verdicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => payoutPlans.id).notNull(),
  planHash: text("plan_hash").notNull(),
  verdictJson: jsonb("verdict_json").notNull(),
  model: text("model").notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => payoutPlans.id).notNull(),
  planHash: text("plan_hash").notNull(),
  approver: text("approver").notNull(),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
});

export const payoutBatches = pgTable("payout_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => payoutPlans.id).notNull(),
  paypalBatchId: text("paypal_batch_id"),
  senderBatchId: text("sender_batch_id").unique().notNull(),
  status: text("status").notNull(),
  rawJson: jsonb("raw_json"),
});

export const payoutItems = pgTable("payout_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").references(() => payoutBatches.id).notNull(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  paypalItemId: text("paypal_item_id"),
  senderItemId: text("sender_item_id").unique().notNull(),
  amount: text("amount").notNull(),
  wallet: text("wallet").notNull(),
  status: text("status").notNull(),
  lastEventAt: timestamp("last_event_at").defaultNow().notNull(),
});

export const donations = pgTable("donations", {
  id: uuid("id").primaryKey().defaultRandom(),
  paypalOrderId: text("paypal_order_id").unique().notNull(),
  amount: text("amount").notNull(),
  donorEmailHash: text("donor_email_hash"),
  status: text("status").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  paypalEventId: text("paypal_event_id").primaryKey(),
  type: text("type").notNull(),
  verified: boolean("verified").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const agentEvents = pgTable("agent_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  correlationId: text("correlation_id").notNull(),
  agent: text("agent").notNull(),
  type: text("type").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  model: text("model"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  channel: text("channel", { enum: ["email", "sms"] }).notNull(),
  language: text("language").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  requestRedacted: jsonb("request_redacted"),
  responseRedacted: jsonb("response_redacted"),
  debugId: text("debug_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

