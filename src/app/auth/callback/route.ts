import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProvisioned } from "@/server/actions/auth-helper";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
      );
    }
    try {
      await ensureUserProvisioned();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to provision user";
      console.error("[auth/callback] ensureUserProvisioned failed:", e);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(`Provisioning failed: ${msg}`)}`,
      );
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
