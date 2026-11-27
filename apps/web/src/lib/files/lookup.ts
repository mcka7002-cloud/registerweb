import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FileLookup } from "./access";

/** FileLookup over the signed-in user's client: a row counts only if RLS lets the user see it. */
export function supabaseFileLookup(supabase: SupabaseClient<Database>): FileLookup {
  const found = (res: { data: unknown[] | null; error: unknown }, label: string) => {
    if (res.error) console.error(`[files] ${label}`, res.error);
    return (res.data?.length ?? 0) > 0;
  };
  return {
    orderWithSlip: async (path) =>
      found(await supabase.from("orders").select("id").eq("slip_path", path).limit(1), "orders"),
    registrationWithPhoto: async (path) =>
      found(await supabase.from("registrations").select("id").eq("payload->>photo_path", path).limit(1), "registrations"),
    studentWithPhoto: async (path) =>
      found(await supabase.from("students").select("id").eq("photo_path", path).limit(1), "students"),
  };
}
