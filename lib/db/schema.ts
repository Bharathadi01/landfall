import { pgTable, text, timestamp, boolean, doublePrecision, integer, jsonb, uuid, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Host Legal Entity & Governance Configuration
export const hosts = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  entityType: text("entity_type", { enum: ["501c3", "fiscal_sponsor", "mutual_aid_fund"] }).notNull(),
  paypalAccountOwner: text("paypal_account_owner").notNull(),
  financeOfficers: text("finance_officers").array().notNull(), // emails or user IDs of finance role holders
  donorRestrictionNotes: text("donor_restriction_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Double-Entry Storm Treasury Ledger
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: text("id").primaryKey(), // e.g. 'paypal_available', 'reserve_protected', 'allocatable', 'committed:plan1'
  name: text("name").notNull(),
  accountType: text("account_type", { enum: ["ASSET", "LIABILITY", "EQUITY"] }).notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: text("transaction_id").notNull(),
  accountId: text("account_id").references(() => ledgerAccounts.id).notNull(),
  direction: text("direction", { enum: ["DEBIT", "CREDIT"] }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  correlationId: text("correlation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. WebAuthn Passkey Credentials
export const passkeyCredentials = pgTable("passkey_credentials", {
  id: text("id").primaryKey(), // base64url credential ID
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role", { enum: ["resident", "volunteer", "coordinator", "finance", "admin"] }).notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").default(0).notNull(),
  transports: text("transports").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. PII Access Audit Log (Immutable)
export const piiAccessLog = pgTable("pii_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  resourceType: text("resource_type").notNull(), // 'household', 'document'
  resourceId: text("resource_id").notNull(),
  accessedFields: text("accessed_fields").array().notNull(),
  reason: text("reason").default("plan_review").notNull(),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});

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
  version: text("version").notNull().default("1.0.0"),
  plainText: text("plain_text").notNull(),
  rulesJson: jsonb("rules_json").notNull(),
  confirmedByCoordinator: text("confirmed_by_coordinator"),
  confirmedByFinance: text("confirmed_by_finance"),
  confirmedAt: timestamp("confirmed_at"),
});

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  status: text("status", { enum: ["draft", "submitted", "verified", "needs_review", "rejected"] }).default("draft").notNull(),
  recipientPath: text("recipient_path", { enum: ["LINKED_PAYPAL", "EMAIL_CLAIM", "ASSISTED", "MANUAL_CHANNEL"] }).default("LINKED_PAYPAL").notNull(),
  caseJson: jsonb("case_json").notNull(), // Contains encrypted PII fields
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  language: text("language").default("en").notNull(),
  wallet: text("wallet", { enum: ["PAYPAL", "VENMO"] }).default("PAYPAL").notNull(),
  receiver: text("receiver").notNull(),
  reconfirmedAt: timestamp("reconfirmed_at"),
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
  status: text("status", { enum: ["open", "planned", "audited", "approved", "paid", "closed", "voided"] }).default("open").notNull(),
});

export const payoutPlans = pgTable("payout_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  activationId: uuid("activation_id").references(() => activations.id).notNull(),
  tranche: text("tranche", { enum: ["TRANCHE_1", "TRANCHE_2"] }).default("TRANCHE_1").notNull(),
  planJson: jsonb("plan_json").notNull(),
  planHash: text("plan_hash").notNull(),
  rulesVersion: text("rules_version").notNull(),
  status: text("status", { enum: ["draft", "rules_valid", "explained", "approved_1", "approved_2", "submitting", "submitted", "settled_partial", "settled", "closed", "voided"] }).default("draft").notNull(),
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
  approverId: text("approver_id").notNull(),
  approverRole: text("approver_role", { enum: ["coordinator", "finance", "admin"] }).notNull(),
  passkeySignature: text("passkey_signature").notNull(),
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

export const pledgeConsents = pgTable("pledge_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  donorEmail: text("donor_email").notNull(),
  consentText: text("consent_text").notNull(),
  consentVersion: text("consent_version").notNull(),
  hazardScope: text("hazard_scope").array().notNull(), // e.g. ["HURRICANE", "FLOOD"]
  programScope: text("program_scope").default("landfall_general").notNull(),
  maxPerEvent: numeric("max_per_event", { precision: 10, scale: 2 }).notNull(),
  seasonCap: numeric("season_cap", { precision: 10, scale: 2 }).notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

export const stormPledges = pgTable("storm_pledges", {
  id: uuid("id").primaryKey().defaultRandom(),
  donorEmail: text("donor_email").notNull(),
  consentId: uuid("consent_id").references(() => pledgeConsents.id),
  vaultPaymentToken: text("vault_payment_token").notNull(),
  amountPerEvent: numeric("amount_per_event", { precision: 10, scale: 2 }).notNull(),
  seasonCap: numeric("season_cap", { precision: 10, scale: 2 }).notNull(),
  chargedThisSeason: numeric("charged_this_season", { precision: 10, scale: 2 }).default("0.00").notNull(),
  hazardScope: text("hazard_scope").array().default(sql`ARRAY['HURRICANE', 'FLOOD', 'STORM_SURGE']::text[]`).notNull(),
  status: text("status", { enum: ["ACTIVE", "PAUSED", "REVOKED", "EXPIRED"] }).default("ACTIVE").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pledgeCharges = pgTable("pledge_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  pledgeId: uuid("pledge_id").references(() => stormPledges.id).notNull(),
  incidentId: text("incident_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["PENDING", "SUBMITTING", "CAPTURED", "FAILED"] }).default("PENDING").notNull(),
  paypalOrderId: text("paypal_order_id"),
  paypalCaptureId: text("paypal_capture_id"),
  idempotencyKey: text("idempotency_key").unique().notNull(),
  outboxPayload: jsonb("outbox_payload"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  paypalSubscriptionId: text("paypal_subscription_id").unique().notNull(),
  planId: text("plan_id").notNull(),
  donorEmail: text("donor_email"),
  status: text("status", {
    enum: ["APPROVAL_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"],
  }).default("APPROVAL_PENDING").notNull(),
  amountMonthly: numeric("amount_monthly", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  lastPaymentAt: timestamp("last_payment_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  channel: text("channel", { enum: ["email", "sms", "in_app"] }).notNull(),
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
