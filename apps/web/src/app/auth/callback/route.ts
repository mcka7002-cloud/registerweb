import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth returns here with ?code=…; exchange it for a session cookie, then go home.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    console.error("[auth/callback] exchangeCodeForSession failed", error);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
