"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Supabase client for client components (e.g. kiosk). Uses the session stored in cookies. */
export function createBrowserClient(): SupabaseClient<Database> {
  return createSsrBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
