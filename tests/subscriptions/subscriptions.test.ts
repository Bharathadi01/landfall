import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateProductRequestSchema,
  CreatePlanRequestSchema,
  CreateSubscriptionRequestSchema,
} from "@/lib/paypal/subscriptions";
import { POST as webhookHandler } from "@/app/api/paypal/webhook/route";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { subscriptions, ledgerEntries, webhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAccountBalance } from "@/lib/ledger/index";

describe("Monthly Sustainers & Subscriptions Engine", () => {
  beforeEach(async () => {
    // Clear test subscriptions and events if any
    await db.delete(subscriptions);
    await db.delete(webhookEvents);
  });

  describe("Schema and Contract Validation", () => {
    it("validates product catalog creation schema", () => {
      const parsed = CreateProductRequestSchema.parse({});
      expect(parsed.name).toBe("Landfall Mutual Aid Sustainer");
      expect(parsed.type).toBe("SERVICE");
      expect(parsed.category).toBe("CHARITY");
    });

    it("validates monthly sustainer plan request", () => {
      const planReq = {
        product_id: "PROD-TEST12345",
        name: "Monthly Mutual Aid $25",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH" as const, interval_count: 1 },
            tenure_type: "REGULAR" as const,
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: "25.00", currency_code: "USD" as const },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: "CONTINUE" as const,
          payment_failure_threshold: 3,
        },
      };

      const parsed = CreatePlanRequestSchema.parse(planReq);
      expect(parsed.billing_cycles[0].pricing_scheme.fixed_price.value).toBe("25.00");
    });

    it("rejects invalid billing cycle frequency", () => {
      const invalid = {
        product_id: "PROD-TEST12345",
        billing_cycles: [
          {
            frequency: { interval_unit: "YEAR" }, // Schema enforces MONTH
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: "25.00" } },
          },
        ],
        payment_preferences: {},
      };

      expect(() => CreatePlanRequestSchema.parse(invalid)).toThrow();
    });

    it("validates subscription application context and subscriber", () => {
      const subReq = {
        plan_id: "P-1234567890",
        subscriber: {
          email_address: "sustainer@example.org",
        },
        application_context: {
          brand_name: "Landfall Mutual Aid",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING" as const,
          user_action: "SUBSCRIBE_NOW" as const,
          return_url: "https://landfall.relief/return",
          cancel_url: "https://landfall.relief/cancel",
        },
      };

      const parsed = CreateSubscriptionRequestSchema.parse(subReq);
      expect(parsed.subscriber?.email_address).toBe("sustainer@example.org");
    });
  });

  describe("Webhook Lifecycle and Accounting Invariants", () => {
    it("handles BILLING.SUBSCRIPTION.CREATED without moving money", async () => {
      const subId = `I-SUB-${Date.now()}`;
      const payload = {
        id: `WH-EVENT-${Date.now()}-1`,
        event_type: "BILLING.SUBSCRIPTION.CREATED",
        resource: {
          id: subId,
          plan_id: "P-TEST-PLAN",
          status: "APPROVAL_PENDING",
          subscriber: {
            email_address: "donor@relief.org",
          },
        },
      };

      const req = new NextRequest("http://localhost:3000/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      const [stored] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));

      expect(stored).toBeDefined();
      expect(stored.status).toBe("APPROVAL_PENDING");
      expect(stored.donorEmail).toBe("donor@relief.org");
    });

    it("INVARIANT: BILLING.SUBSCRIPTION.ACTIVATED marks status active but DOES NOT move ledger money", async () => {
      const subId = `I-SUB-${Date.now()}`;
      // Pre-seed subscription
      await db.insert(subscriptions).values({
        paypalSubscriptionId: subId,
        planId: "P-TEST-PLAN",
        donorEmail: "donor@relief.org",
        status: "APPROVAL_PENDING",
        amountMonthly: "25.00",
      });

      const initialAvailable = await getAccountBalance("paypal_available");
      const initialProtected = await getAccountBalance("reserve_protected");

      const payload = {
        id: `WH-EVENT-${Date.now()}-2`,
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource: {
          id: subId,
          status: "ACTIVE",
        },
      };

      const req = new NextRequest("http://localhost:3000/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      const [updated] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));
      expect(updated.status).toBe("ACTIVE");

      // Verify no money moved
      const finalAvailable = await getAccountBalance("paypal_available");
      const finalProtected = await getAccountBalance("reserve_protected");
      expect(finalAvailable).toBe(initialAvailable);
      expect(finalProtected).toBe(initialProtected);
    });

    it("PAYMENT.SALE.COMPLETED moves money into ledger and is idempotent against duplicates", async () => {
      const subId = `I-SUB-${Date.now()}`;
      const saleId = `SALE-${Date.now()}`;

      await db.insert(subscriptions).values({
        paypalSubscriptionId: subId,
        planId: "P-TEST-PLAN",
        donorEmail: "donor@relief.org",
        status: "ACTIVE",
        amountMonthly: "25.00",
      });

      const initialAvailable = await getAccountBalance("paypal_available");
      const initialProtected = await getAccountBalance("reserve_protected");

      const payload = {
        id: `WH-EVENT-SALE-${Date.now()}`,
        event_type: "PAYMENT.SALE.COMPLETED",
        resource: {
          id: saleId,
          billing_agreement_id: subId,
          amount: {
            total: "25.00",
            currency: "USD",
          },
          state: "completed",
        },
      };

      const req1 = new NextRequest("http://localhost:3000/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res1 = await webhookHandler(req1);
      expect(res1.status).toBe(200);

      // Verify ledger has been credited 2500 cents
      const postAvailable = await getAccountBalance("paypal_available");
      const postProtected = await getAccountBalance("reserve_protected");
      expect(postAvailable).toBe(initialAvailable + 2500);
      expect(postProtected).toBe(initialProtected + 2500);

      // Verify subscription record updated lastPaymentAt
      const [subRecord] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));
      expect(subRecord.lastPaymentAt).toBeDefined();

      // REPLAY / DUPLICATE TEST: Same webhook event sent again
      const req2 = new NextRequest("http://localhost:3000/api/paypal/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const res2 = await webhookHandler(req2);
      expect(res2.status).toBe(200);

      // Balances must remain unchanged (no double crediting)
      const afterDuplicateAvailable = await getAccountBalance("paypal_available");
      const afterDuplicateProtected = await getAccountBalance("reserve_protected");
      expect(afterDuplicateAvailable).toBe(postAvailable);
      expect(afterDuplicateProtected).toBe(postProtected);
    });

    it("handles BILLING.SUBSCRIPTION.CANCELLED and SUSPENDED status transitions", async () => {
      const subId = `I-SUB-${Date.now()}`;
      await db.insert(subscriptions).values({
        paypalSubscriptionId: subId,
        planId: "P-TEST-PLAN",
        donorEmail: "donor@relief.org",
        status: "ACTIVE",
        amountMonthly: "25.00",
      });

      const suspendPayload = {
        id: `WH-EVENT-SUSP-${Date.now()}`,
        event_type: "BILLING.SUBSCRIPTION.SUSPENDED",
        resource: { id: subId },
      };

      await webhookHandler(
        new NextRequest("http://localhost:3000/api/paypal/webhook", {
          method: "POST",
          body: JSON.stringify(suspendPayload),
        })
      );

      let [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));
      expect(sub.status).toBe("SUSPENDED");

      const cancelPayload = {
        id: `WH-EVENT-CANC-${Date.now()}`,
        event_type: "BILLING.SUBSCRIPTION.CANCELLED",
        resource: { id: subId },
      };

      await webhookHandler(
        new NextRequest("http://localhost:3000/api/paypal/webhook", {
          method: "POST",
          body: JSON.stringify(cancelPayload),
        })
      );

      [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));
      expect(sub.status).toBe("CANCELLED");
    });

    it("prevents out-of-order webhook delivery from rolling back active subscriptions", async () => {
      const subId = `I-SUB-OUT-OF-ORDER-${Date.now()}`;

      // 1. First event to arrive: ACTIVATED (e.g. network inversion)
      await db.insert(subscriptions).values({
        paypalSubscriptionId: subId,
        planId: "P-TEST-PLAN",
        donorEmail: "donor@relief.org",
        status: "ACTIVE",
        amountMonthly: "25.00",
      });

      // 2. Delayed CREATED event arrives afterwards
      const delayedCreatedPayload = {
        id: `WH-DELAYED-CREATED-${Date.now()}`,
        event_type: "BILLING.SUBSCRIPTION.CREATED",
        resource: {
          id: subId,
          plan_id: "P-TEST-PLAN",
          status: "APPROVAL_PENDING",
        },
      };

      await webhookHandler(
        new NextRequest("http://localhost:3000/api/paypal/webhook", {
          method: "POST",
          body: JSON.stringify(delayedCreatedPayload),
        })
      );

      // Status must remain ACTIVE (precedence prevents rollback to APPROVAL_PENDING)
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, subId));
      expect(sub.status).toBe("ACTIVE");
    });
  });
});

