import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals, the PWA manifest and static files.
    "/((?!_next/static|_next/image|_next/data|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|js|css|woff2?|map)$).*)",
  ],
};
