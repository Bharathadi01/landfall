import { NextRequest, NextResponse } from "next/server";
import {
  getAuthoritativeEvidenceManifest,
  getAuthoritativeRehearsalManifest,
  getRedactedManifestJson,
} from "@/lib/workflow/manifest";
import { verifyEvidenceManifest } from "@/lib/workflow/manifest-verifier";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profile = searchParams.get("profile");
    const format = searchParams.get("format");

    const manifest =
      profile === "rehearsal"
        ? getAuthoritativeRehearsalManifest()
        : getAuthoritativeEvidenceManifest();

    if (format === "redacted") {
      const redacted = getRedactedManifestJson(manifest);
      return new NextResponse(redacted, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const verification = verifyEvidenceManifest(manifest);

    return NextResponse.json({
      manifest,
      verification,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
