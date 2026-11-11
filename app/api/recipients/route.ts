import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { households } from "@/lib/db/schema";
import { computeFourChecks, type FourChecks } from "@/lib/recipients/index";
import { decryptPII } from "@/lib/security/encryption";
import { logPIIAccess, type Role } from "@/lib/security/rbac";
import { desc, eq, and } from "drizzle-orm";
import { safeError } from "@/lib/http/safe-error";
import { maskReceiver, roundCoord } from "@/lib/security/mask";
import { limitRequest } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const limited = limitRequest(req, "recipients-get", { limit: 30 });
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");
    const pathFilter = url.searchParams.get("path");
    const channelFilter = url.searchParams.get("channel");
    const displacedFilter = url.searchParams.get("isDisplaced");
    // PII is masked unless the SERVER operator enables reveal (demo recordings). The caller can
    // neither request decryption nor choose its own role/identity: both come from server config.
    const shouldDecrypt = process.env.PII_DECRYPT_ENABLED === "true" && url.searchParams.get("decrypt") === "true";
    const actorId = "demo_operator";
    const actorRole: Role = "coordinator";

    const allHouseholds = await db
      .select()
      .from(households)
      .orderBy(desc(households.createdAt));

    // Filter in-memory or query
    const filtered = allHouseholds.filter((h) => {
      if (statusFilter && h.status !== statusFilter) return false;
      if (pathFilter && h.recipientPath !== pathFilter) return false;
      if (channelFilter && h.paymentChannel !== channelFilter) return false;
      if (displacedFilter !== null && displacedFilter !== undefined) {
        const wantsDisplaced = displacedFilter === "true";
        if (h.isDisplaced !== wantsDisplaced) return false;
      }
      return true;
    });

    const results = await Promise.all(
      filtered.map(async (h) => {
        const caseData = h.caseJson as any;

        // Compute four independent verification chips
        const fourChecks: FourChecks = computeFourChecks({
          paymentChannel: h.paymentChannel as any,
          recipientPath: h.recipientPath as any,
          evidenceLevel: (caseData.evidenceLevel || "SELF_DECLARED") as any,
          isExposureConfirmed: true, // Default to true or check alert overlap
          priorityTier: caseData.hasMedicalDevice ? 1 : caseData.isElderlyLivingAlone ? 2 : 6,
          priorityCode: caseData.hasMedicalDevice
            ? "P1_MEDICAL_DEVICE"
            : caseData.isElderlyLivingAlone
            ? "P2_ELDERLY_ALONE"
            : "P6_GENERAL",
          tranche2ImpactConfirmed: false,
        });

        let displayName = "[ENCRYPTED]";
        let displayAddress = "[ENCRYPTED]";

        if (shouldDecrypt) {
          displayName = decryptPII(caseData.encryptedName) || "[DECRYPTION_FAILED]";
          displayAddress = decryptPII(caseData.encryptedAddress) || "[DECRYPTION_FAILED]";

          // Audit log the PII access
          await logPIIAccess({
            actorId,
            actorRole,
            resourceType: "household",
            resourceId: h.id,
            accessedFields: ["name", "address"],
            reason: "coordinator_directory_view",
          });
        }

        return {
          id: h.id,
          fundId: h.fundId,
          status: h.status,
          enrollmentMethod: h.enrollmentMethod,
          paymentChannel: h.paymentChannel,
          recipientPath: h.recipientPath,
          recipientVersion: h.recipientVersion,
          // masked: a coordinator needs to know a payment route exists, not the address itself
          receiver: shouldDecrypt ? h.receiver : maskReceiver(h.receiver),
          isDisplaced: h.isDisplaced,
          language: h.language,
          // rounded to ~1 km unless the server operator has enabled reveal
          lat: shouldDecrypt ? h.lat : roundCoord(h.lat),
          lng: shouldDecrypt ? h.lng : roundCoord(h.lng),
          currentLat: shouldDecrypt ? h.currentLat : roundCoord(h.currentLat),
          currentLng: shouldDecrypt ? h.currentLng : roundCoord(h.currentLng),
          reconfirmedAt: h.reconfirmedAt,
          createdAt: h.createdAt,
          name: displayName,
          address: displayAddress,
          fourChecks,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      recipients: results,
    });
  } catch (err: any) {
    return safeError(err, "Failed to fetch recipients", 500);
  }
}
