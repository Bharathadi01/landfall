import { pgTable, text, timestamp, boolean, doublePrecision, integer, jsonb, uuid, numeric, unique } from "drizzle-orm/pg-core";
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
  enrollmentMethod: text("enrollment_method", { enum: ["SELF_SERVICE", "ASSISTED", "POST_EVENT"] }).default("SELF_SERVICE").notNull(),
  paymentChannel: text("payment_channel", { enum: ["PAYPAL_ID", "EMAIL", "MANUAL", "UNSET"] }).default("UNSET").notNull(),
  recipientPath: text("recipient_path", { enum: ["LINKED_PAYPAL", "EMAIL_CLAIM", "ASSISTED", "MANUAL_CHANNEL"] }).default("LINKED_PAYPAL").notNull(),
  recipientVersion: integer("recipient_version").default(1).notNull(),
  caseJson: jsonb("case_json").notNull(), // Contains encrypted PII fields
  lat: doublePrecision("lat"), // Original landfall / residence latitude
  lng: doublePrecision("lng"), // Original landfall / residence longitude
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  isDisplaced: boolean("is_displaced").default(false).notNull(),
  language: text("language").default("en").notNull(),
  wallet: text("wallet", { enum: ["PAYPAL", "VENMO"] }).default("PAYPAL").notNull(),
  receiver: text("receiver").notNull(),
  reconfirmedAt: timestamp("reconfirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locationHistory = pgTable("location_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  address: text("address").notNull(), // Encrypted PII string
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  isDisplaced: boolean("is_displaced").default(false).notNull(),
  recordedBy: text("recorded_by").notNull(),
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recipientConsents = pgTable("recipient_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  purpose: text("purpose", {
    enum: ["TERMS_OF_SERVICE", "PAYMENT_ROUTING", "LOCATION_TRACKING", "EMERGENCY_DISCLOSURE"],
  }).notNull(),
  consentVersion: text("consent_version").notNull(),
  language: text("language").default("en").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  actor: text("actor").notNull(),
  method: text("method", {
    enum: ["SELF_DIGITAL", "VERBAL_TO_VOLUNTEER", "PAPER_AFFIDAVIT"],
  }).default("SELF_DIGITAL").notNull(),
  withdrawnAt: timestamp("withdrawn_at"),
});

export const volunteerAttestations = pgTable("volunteer_attestations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  volunteerId: text("volunteer_id").notNull(),
  attestationType: text("attestation_type", {
    enum: ["RESIDENCE_VERIFIED", "PHYSICAL_INSPECTION", "COMMUNITY_VOUCH"],
  }).notNull(),
  isDirectObservation: boolean("is_direct_observation").default(true).notNull(),
  statementNote: text("statement_note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id).notNull(),
  caseReference: text("case_reference").unique().notNull(),
  category: text("category", {
    enum: ["TIER_DISPUTE", "AMOUNT_DISPUTE", "EXPOSURE_DISPUTE", "EVIDENCE_SUPPLEMENT", "OTHER"],
  }).notNull(),
  explanation: text("explanation").notNull(),
  status: text("status", {
    enum: ["SUBMITTED", "NEEDS_INFORMATION", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
  }).default("SUBMITTED").notNull(),
  slaDeadline: timestamp("sla_deadline").notNull(),
  assignedReviewerId: text("assigned_reviewer_id"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
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
  eventKey: text("event_key"),
  event: text("event").notNull(),
  headline: text("headline"),
  severity: text("severity").notNull(),
  urgency: text("urgency"),
  certainty: text("certainty"),
  status: text("status").default("Actual").notNull(),
  messageType: text("message_type").default("Alert").notNull(),
  phenomena: text("phenomena"),
  significance: text("significance"),
  areaDesc: text("area_desc"),
  rawJson: jsonb("raw_json").notNull(),
  geometryGeojson: jsonb("geometry_geojson"),
  onset: timestamp("onset"),
  expires: timestamp("expires"),
  effective: timestamp("effective"),
  source: text("source", { enum: ["live", "replay"] }).default("live").notNull(),
  mode: text("mode", { enum: ["LIVE", "HISTORICAL_REPLAY", "SYNTHETIC"] }).default("LIVE").notNull(),
  isTranche1Eligible: boolean("is_tranche1_eligible").default(false).notNull(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activations = pgTable("activations", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  alertId: uuid("alert_id").references(() => alerts.id).notNull(),
  activationJson: jsonb("activation_json").notNull(),
  status: text("status", { enum: ["open", "planned", "audited", "approved", "paid", "closed", "voided"] }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

/**
 * DURABLE PAYOUT RECORDS (audit D-1).
 *
 * `payout_batches` / `payout_items` above predate the Treasurer and are tied by foreign key to
 * plan/household uuids that the guided flow never creates, so nothing could ever write to them.
 * These three tables carry what PayPal actually told us, keyed by identifiers we control:
 *  - payout_batch_records : one row per PayPal batch (id returned at creation, status at last sync)
 *  - payout_item_records  : one row per payment, keyed by our deterministic sender_item_id; the
 *                           PayPal item id / transaction id are filled in when first observed
 *  - payout_status_history: append-only log of every status change and where it came from
 * Statuses are PayPal's own vocabulary, plus the internal pre-provider state SUBMITTED.
 */
export const payoutBatchRecords = pgTable("payout_batch_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  paypalBatchId: text("paypal_batch_id").unique().notNull(),
  senderBatchId: text("sender_batch_id").unique().notNull(),
  planId: text("plan_id"),
  status: text("status").notNull(), // PayPal batch_status at last observation
  amountCents: integer("amount_cents"),
  feeCents: integer("fee_cents"),
  currency: text("currency").default("USD").notNull(),
  itemCount: integer("item_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncSource: text("last_sync_source"), // creation | refresh | webhook
  lastSyncError: text("last_sync_error"),
});

export const payoutItemRecords = pgTable("payout_item_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderItemId: text("sender_item_id").unique().notNull(),
  paypalBatchId: text("paypal_batch_id").notNull(),
  paypalItemId: text("paypal_item_id").unique(), // null until PayPal reports it
  transactionId: text("transaction_id"),
  status: text("status").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  feeCents: integer("fee_cents"),
  providerTime: timestamp("provider_time"), // PayPal time_processed
  lastEventTime: timestamp("last_event_time"), // PayPal webhook create_time of the last applied event
  lastObservedAt: timestamp("last_observed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payoutStatusHistory = pgTable("payout_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderItemId: text("sender_item_id").notNull(),
  paypalItemId: text("paypal_item_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  source: text("source").notNull(), // creation | refresh | webhook
  eventId: text("event_id"), // PayPal webhook event id, when applicable
  providerTime: timestamp("provider_time"),
  ledgerTransactionIds: text("ledger_transaction_ids").array(),
  note: text("note"),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
});

/**
 * RESIDENT REPORTS (persisted). Recipient-reported evidence only: it never changes PayPal's status.
 * `channel` is web (buttons) or voice (transcribed + classified); both keep the resident's own words.
 */
export const accessReports = pgTable("access_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseRef: text("case_ref").notNull(),
  kind: text("kind", { enum: ["RECEIVED", "CANT_ACCESS"] }).notNull(),
  reason: text("reason"),
  channel: text("channel", { enum: ["web", "voice"] }).default("web").notNull(),
  language: text("language"),
  transcript: text("transcript"),
  translation: text("translation"),
  classifier: jsonb("classifier"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * ACTION PROPOSALS: the only way money moves after the initial plan. A proposal is created by a coordinator,
 * approved by two different people (one Finance), and executed by the Treasurer — never by a request body or an AI.
 */
export const actionProposals = pgTable("action_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["CANCEL_ITEM", "NEW_PAYOUT", "REISSUE"] }).notNull(),
  targetSenderItemId: text("target_sender_item_id"),
  parentSenderItemId: text("parent_sender_item_id"),
  payloadJson: jsonb("payload_json").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status", { enum: ["PROPOSED", "APPROVED", "EXECUTING", "EXECUTED", "FAILED", "REJECTED"] }).default("PROPOSED").notNull(),
  proposedBy: text("proposed_by").notNull(),
  idempotencyKey: text("idempotency_key").unique().notNull(),
  resultJson: jsonb("result_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
});

export const actionApprovals = pgTable(
  "action_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").references(() => actionProposals.id).notNull(),
    approverId: text("approver_id").notNull(),
    approverName: text("approver_name").notNull(),
    role: text("role", { enum: ["coordinator", "finance"] }).notNull(),
    method: text("method", { enum: ["WEBAUTHN", "DEMO_KEY"] }).notNull(),
    credentialId: text("credential_id"),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // one approval per person per proposal — enforced by the database, not just by the route
  (t) => ({ onePerPerson: unique("action_approvals_one_per_person").on(t.proposalId, t.approverId) })
);

/** Single-use WebAuthn challenges, bound to the exact thing being approved. */
export const webauthnChallenges = pgTable("webauthn_challenges", {
  challenge: text("challenge").primaryKey(),
  subject: text("subject").notNull(),
  purpose: text("purpose", { enum: ["register", "approve"] }).notNull(),
  bindHash: text("bind_hash"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

/** Every ledger-vs-PayPal comparison, kept: who ran it, what was compared, and the explained remainder. */
export const reconciliationRuns = pgTable("reconciliation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull(), // IN_SYNC | EXPLAINED_DIFFERENCE | TIMING_DIFFERENCE | MISMATCH_ALERT | UNVERIFIED
  ledgerCents: integer("ledger_cents"),
  paypalCents: integer("paypal_cents"),
  unexplainedCents: integer("unexplained_cents"),
  report: jsonb("report").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Every AI run: which model (or labelled fallback) answered, what it called, how long it took. */
export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // case_investigation | watch_officer | studio | grid_ask | voice | guard
  subject: text("subject"),
  model: text("model"),
  answeredBy: text("answered_by", { enum: ["model", "deterministic"] }).notNull(),
  latencyMs: integer("latency_ms"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  toolCalls: jsonb("tool_calls"),
  result: jsonb("result"),
  evidenceHash: text("evidence_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Stakeholder feedback. Only real, consented responses are ever shown anywhere. */
export const validationResponses = pgTable("validation_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").notNull(),
  orgType: text("org_type").notNull(),
  problemToday: text("problem_today").notNull(),
  wouldUse: integer("would_use"), // 1-5
  comments: text("comments"),
  contact: text("contact"), // only if they opted in
  consent: boolean("consent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const watchOfficerSessions = pgTable("watch_officer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const watchOfficerRuns = pgTable("watch_officer_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").unique().notNull(),
  sessionId: uuid("session_id").references(() => watchOfficerSessions.id),
  fundId: uuid("fund_id").references(() => funds.id).notNull(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  query: text("query").notNull(),
  mode: text("mode", { enum: ["LIVE", "HISTORICAL_REPLAY", "SYNTHETIC"] }).default("LIVE").notNull(),
  readinessState: text("readiness_state").notNull(),
  responseJson: jsonb("response_json").notNull(),
  evidenceJson: jsonb("evidence_json").notNull(),
  model: text("model"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
