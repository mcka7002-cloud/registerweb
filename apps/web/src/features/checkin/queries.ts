import type { Me } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface KioskBranch {
  id: string;
  name: string;
}

export interface KioskSession {
  id: string;
  startsAt: string;
  endsAt: string;
}

/** Branches this user may run the kiosk for: admin = all, others = their profile_branches. */
export async function listKioskBranches(me: Me): Promise<KioskBranch[]> {
  if (me.role !== "admin" && me.branchIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase.from("branches").select("id, name").order("code");
  if (me.role !== "admin") query = query.in("id", me.branchIds);
  const { data, error } = await query;
  if (error) console.error("[listKioskBranches]", error);
  return data ?? [];
}

/** Class sessions of one branch on one date (not cancelled), by start time. */
export async function listSessions(branchId: string, date: string): Promise<KioskSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at")
    .eq("branch_id", branchId)
    .eq("class_date", date)
    .eq("cancelled", false)
    .order("starts_at");
  if (error) console.error("[listSessions]", error);
  return (data ?? []).map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at }));
}
