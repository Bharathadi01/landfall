import { NextResponse } from "next/server";
import { residentCode } from "@/lib/auth/resident-code";

export const dynamic = "force-dynamic";

/**
 * The guided tour's "resident" step looks up the featured synthetic household exactly as a visitor would. The same reference and code are
 * already printed on the public judge test card (/judges), so this reveals nothing new: it only saves the tour from scraping that page.
 * Off when JUDGE_MODE_ENABLED=false, like the card itself.
 */
const FEATURED_HOUSEHOLD = "hh_tbw_003";

export async function GET() {
  if (process.env.JUDGE_MODE_ENABLED === "false") return NextResponse.json({ error: "judge_mode_disabled", message: "Judge test access is switched off on this deployment." }, { status: 403 });
  return NextResponse.json({ ref: FEATURED_HOUSEHOLD, code: await residentCode(FEATURED_HOUSEHOLD) }, { headers: { "Cache-Control": "no-store" } });
}
