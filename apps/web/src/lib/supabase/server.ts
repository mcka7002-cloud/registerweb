import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Supabase client for server components, server actions and route handlers (acts as the signed-in user). */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, where cookies are read-only. The middleware refreshes the session.
        }
      },
    },
  });
}
