import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only: a form submit from the top bar. 303 so the browser follows with GET.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth/signout] signOut failed", error);
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
