import { NextResponse } from "next/server";
import { ensureUserProvisioned } from "@/server/actions/auth-helper";

export async function POST() {
  const user = await ensureUserProvisioned();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ ok: true });
}
