import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth";

export interface BranchRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  tax_id: string | null;
  vat_enabled: boolean;
  vat_inclusive: boolean;
  vat_rate: number;
}

export async function listBranches(): Promise<BranchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, code, name, address, tax_id, branch_settings(vat_enabled, vat_inclusive, vat_rate)")
    .order("code");
  if (error) console.error("[listBranches]", error);
  return (data ?? []).map((b) => {
    const s = Array.isArray(b.branch_settings) ? b.branch_settings[0] : b.branch_settings;
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address,
      tax_id: b.tax_id,
      vat_enabled: s?.vat_enabled ?? false,
      vat_inclusive: s?.vat_inclusive ?? true,
      vat_rate: Number(s?.vat_rate ?? 7),
    };
  });
}

export async function listBranchOptions(): Promise<{ id: string; code: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("branches").select("id, code, name").order("code");
  if (error) console.error("[listBranchOptions]", error);
  return data ?? [];
}

export interface ScheduleRow {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  is_active: boolean;
}

export async function listSchedules(branchId: string): Promise<ScheduleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_schedules")
    .select("id, weekday, starts_at, ends_at, capacity, is_active")
    .eq("branch_id", branchId)
    .order("weekday")
    .order("starts_at");
  if (error) console.error("[listSchedules]", error);
  return data ?? [];
}

/** Count and last date of upcoming class sessions in a branch (from today). */
export async function upcomingSessionSummary(branchId: string, today: string) {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("class_sessions")
    .select("class_date", { count: "exact" })
    .eq("branch_id", branchId)
    .eq("cancelled", false)
    .gte("class_date", today)
    .order("class_date", { ascending: false })
    .limit(1);
  if (error) console.error("[upcomingSessionSummary]", error);
  return { count: count ?? 0, lastDate: data?.[0]?.class_date ?? null };
}

export interface TemplateRow {
  id: string;
  branch_id: string | null;
  name: string;
  price: number;
  sessions: number | null;
  duration_days: number;
  makeup_allowed: number;
  sort_order: number;
  is_active: boolean;
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("package_templates")
    .select("id, branch_id, name, price, sessions, duration_days, makeup_allowed, sort_order, is_active")
    .order("sort_order")
    .order("price");
  if (error) console.error("[listTemplates]", error);
  return (data ?? []).map((t) => ({ ...t, price: Number(t.price) }));
}

/** School-wide membership prices (price_settings with branch_id null). */
export async function getMembershipPrices(): Promise<{ membership_new: number; membership_renewal: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_settings")
    .select("key, amount")
    .is("branch_id", null)
    .in("key", ["membership_new", "membership_renewal"]);
  if (error) console.error("[getMembershipPrices]", error);
  const get = (k: string) => Number(data?.find((r) => r.key === k)?.amount ?? 0);
  return { membership_new: get("membership_new"), membership_renewal: get("membership_renewal") };
}

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  branch_ids: string[];
}

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, profile_branches(branch_id)")
    .order("role")
    .order("full_name");
  if (error) console.error("[listUsers]", error);
  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    branch_ids: (p.profile_branches ?? []).map((b) => b.branch_id),
  }));
}
