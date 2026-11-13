"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays } from "@registerweb/domain";
import { requireRole } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { todayInBangkok } from "@/lib/utils";
import { INVALID_INPUT, writeResult } from "./write-result";

const uuid = z.string().uuid();
const optText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

// ---------- branches + branch_settings ----------
const branchSchema = z.object({
  id: uuid.nullable(),
  code: z.string().trim().min(1).max(10).toUpperCase(),
  name: z.string().trim().min(1),
  address: optText,
  tax_id: optText,
  vat_enabled: z.boolean(),
  vat_inclusive: z.boolean(),
  vat_rate: z.number().min(0).max(100),
});
export type BranchInput = z.input<typeof branchSchema>;

export async function saveBranch(input: BranchInput): Promise<RpcResult<{ id: string }>> {
  await requireRole("admin");
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { id, vat_enabled, vat_inclusive, vat_rate, ...branch } = parsed.data;
  const supabase = await createClient();

  let branchId = id;
  if (branchId) {
    const { error } = await supabase.from("branches").update(branch).eq("id", branchId);
    if (error) return writeResult(error, { id: branchId });
  } else {
    const { data, error } = await supabase.from("branches").insert(branch).select("id").single();
    if (error || !data) return writeResult(error, { id: "" });
    branchId = data.id;
  }

  const { error } = await supabase
    .from("branch_settings")
    .upsert({ branch_id: branchId, vat_enabled, vat_inclusive, vat_rate, updated_at: new Date().toISOString() });
  revalidatePath("/admin/branches");
  return writeResult(error, { id: branchId });
}

// ---------- class_schedules ----------
const time = z.string().regex(/^\d{2}:\d{2}$/);
const scheduleSchema = z
  .object({
    branch_id: uuid,
    weekday: z.number().int().min(0).max(6),
    starts_at: time,
    ends_at: time,
    capacity: z.number().int().positive().nullable(),
  })
  .refine((s) => s.ends_at > s.starts_at);
export type ScheduleInput = z.input<typeof scheduleSchema>;

export async function addSchedule(input: ScheduleInput): Promise<RpcResult<null>> {
  await requireRole("admin");
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const supabase = await createClient();
  const { error } = await supabase.from("class_schedules").insert(parsed.data);
  revalidatePath("/admin/schedule");
  return writeResult(error, null);
}

export async function setScheduleActive(id: string, isActive: boolean): Promise<RpcResult<null>> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return INVALID_INPUT;
  const supabase = await createClient();
  const { error } = await supabase.from("class_schedules").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/schedule");
  return writeResult(error, null);
}

/** Creates class sessions for today .. today+27 (4 weeks) from the branch's active schedule. */
export async function generateSessions(branchId: string): Promise<RpcResult<{ created: number }>> {
  await requireRole("admin");
  if (!uuid.safeParse(branchId).success) return INVALID_INPUT;
  const today = todayInBangkok();
  const res = await callRpc<{ created: number }>("generate_class_sessions", {
    p_branch: branchId,
    p_from: today,
    p_to: addDays(today, 27),
  });
  if (res.ok) revalidatePath("/admin/schedule");
  return res;
}

// ---------- package_templates ----------
const templateSchema = z.object({
  id: uuid.nullable(),
  branch_id: uuid.nullable(),
  name: z.string().trim().min(1),
  price: z.number().min(0),
  sessions: z.number().int().positive().nullable(),
  duration_days: z.number().int().positive(),
  makeup_allowed: z.number().int().min(0),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});
export type TemplateInput = z.input<typeof templateSchema>;

export async function saveTemplate(input: TemplateInput): Promise<RpcResult<null>> {
  await requireRole("admin");
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("package_templates").update(row).eq("id", id)
    : await supabase.from("package_templates").insert(row);
  revalidatePath("/admin/packages");
  return writeResult(error, null);
}

export async function setTemplateActive(id: string, isActive: boolean): Promise<RpcResult<null>> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return INVALID_INPUT;
  const supabase = await createClient();
  const { error } = await supabase.from("package_templates").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/packages");
  return writeResult(error, null);
}

// ---------- price_settings (membership, all branches) ----------
const membershipSchema = z.object({
  membership_new: z.number().min(0),
  membership_renewal: z.number().min(0),
});
export type MembershipPriceInput = z.input<typeof membershipSchema>;

export async function saveMembershipPrices(input: MembershipPriceInput): Promise<RpcResult<null>> {
  await requireRole("admin");
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const supabase = await createClient();

  for (const key of ["membership_new", "membership_renewal"] as const) {
    const amount = parsed.data[key];
    const { data: existing, error: readError } = await supabase
      .from("price_settings")
      .select("id")
      .is("branch_id", null)
      .eq("key", key)
      .maybeSingle();
    if (readError) return writeResult(readError, null);
    const { error } = existing
      ? await supabase.from("price_settings").update({ amount }).eq("id", existing.id)
      : await supabase.from("price_settings").insert({ branch_id: null, key, amount });
    if (error) return writeResult(error, null);
  }
  revalidatePath("/admin/packages");
  return { ok: true, data: null };
}

// ---------- profiles.role + profile_branches ----------
const userSchema = z.object({
  profile_id: uuid,
  role: z.enum(["admin", "branch_manager", "teacher", "customer", "kiosk"]),
  branch_ids: z.array(uuid),
});
export type UserAccessInput = z.input<typeof userSchema>;

export async function saveUserAccess(input: UserAccessInput): Promise<RpcResult<null>> {
  const me = await requireRole("admin");
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { profile_id, role, branch_ids } = parsed.data;
  // Guard against locking yourself out of the admin pages.
  if (profile_id === me.id && role !== "admin") return { ok: false, code: "SELF_ROLE" };

  const supabase = await createClient();
  const { error: roleError } = await supabase.from("profiles").update({ role }).eq("id", profile_id);
  if (roleError) return writeResult(roleError, null);

  const { data: current, error: readError } = await supabase
    .from("profile_branches")
    .select("branch_id")
    .eq("profile_id", profile_id);
  if (readError) return writeResult(readError, null);

  const have = new Set((current ?? []).map((r) => r.branch_id));
  const want = new Set(branch_ids);
  const toRemove = [...have].filter((b) => !want.has(b));
  const toAdd = [...want].filter((b) => !have.has(b));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("profile_branches")
      .delete()
      .eq("profile_id", profile_id)
      .in("branch_id", toRemove);
    if (error) return writeResult(error, null);
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("profile_branches")
      .insert(toAdd.map((branch_id) => ({ profile_id, branch_id })));
    if (error) return writeResult(error, null);
  }
  revalidatePath("/admin/users");
  return { ok: true, data: null };
}
