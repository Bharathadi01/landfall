import { NextResponse } from "next/server";
import { computeTreasuryWaterfall } from "@/lib/treasury/waterfall";
import { getTreasuryWaterfall } from "@/lib/ledger/index";
import { getAccountBalances } from "@/lib/paypal/reporting";
import { db } from "@/lib/db/client";
import { households, stormPledges, subscriptions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Query internal ledger waterfall
    const ledgerWaterfall = await getTreasuryWaterfall();

    // 2. Query PayPal Reporting if ledger paypal_available is 0
    let availableCents = ledgerWaterfall.paypalAvailableCents;
    if (availableCents === 0) {
      try {
        const balances = await getAccountBalances("treasury_waterfall");
        if (balances.availableUsd > 0) {
          availableCents = Math.round(balances.availableUsd * 100);
        }
      } catch (err) {
        console.warn("Using ledger fallback for waterfall available balance:", err);
      }
    }

    // 3. Query Households count
    const [eligibleCountRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(households);

    // 4. Query active storm pledges
    const [activePledgesRes] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmountPerEvent: sql<string>`coalesce(sum(amount_per_event), '0.00')`,
      })
      .from(stormPledges)
      .where(eq(stormPledges.status, "ACTIVE"));

    // 5. Query active monthly sustainers
    const [activeSustainersRes] = await db
      .select({
        count: sql<number>`count(*)`,
        totalMonthly: sql<string>`coalesce(sum(amount_monthly), '0.00')`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "ACTIVE"));

    const eligibleCount = Number(eligibleCountRes?.count || 0);
    const activePledgesCount = Number(activePledgesRes?.count || 0);
    const contingentPledgesCents = Math.round(
      parseFloat(activePledgesRes?.totalAmountPerEvent || "0.00") * 100
    );

    const activeSustainersCount = Number(activeSustainersRes?.count || 0);
    const monthlySustainerCents = Math.round(
      parseFloat(activeSustainersRes?.totalMonthly || "0.00") * 100
    );

    const waterfall = computeTreasuryWaterfall({
      paypalAvailableCents: availableCents,
      reserveProtectedCents: ledgerWaterfall.reserveProtectedCents,
      feesReservedCents: ledgerWaterfall.feesReservedCents,
      committedCents: ledgerWaterfall.committedCents,
      contingentPledgesCents,
      activePledgesCount,
      eligibleHouseholdsCount: eligibleCount,
    });

    return NextResponse.json({
      ...waterfall,
      activeSustainersCount,
      monthlySustainerCents,
      paidOutCents: ledgerWaterfall.paidOutCents,
      returnedCents: ledgerWaterfall.returnedCents,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Failed to load treasury waterfall" },
      { status: 500 }
    );
  }
}
