import { NextResponse } from "next/server";
import { createAppeal } from "@/lib/recipients/index";

export async function POST(req: Request) {
  try {
    const { householdId, reason, contactPreference } = await req.json();

    if (!householdId || !reason) {
      return NextResponse.json(
        { error: "householdId and reason are required" },
        { status: 400 }
      );
    }

    const appeal = createAppeal({ householdId, reason, contactPreference: contactPreference || "email" });

    return NextResponse.json({
      success: true,
      appeal,
      message: "Appeal submitted. A human coordinator will review within 24 hours.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit appeal" },
      { status: 500 }
    );
  }
}
