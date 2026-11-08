import { NextResponse } from "next/server";
import { getPasskeyRegistrationOptions } from "@/lib/security/passkeys";

export async function POST(req: Request) {
  try {
    const { userId, userName } = await req.json();
    if (!userId || !userName) {
      return NextResponse.json({ error: "userId and userName are required" }, { status: 400 });
    }

    const options = await getPasskeyRegistrationOptions(userId, userName);
    return NextResponse.json(options);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate registration options" }, { status: 500 });
  }
}
