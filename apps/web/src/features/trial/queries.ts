import { createClient } from "@/lib/supabase/server";
import { todayInBangkok } from "@/lib/utils";
import { parseTrialNotes, type TrialNotes } from "./shared";

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface SessionSlot {
  id: string;
  class_date: string;
  starts_at: string;
  ends_at: string;
}

export interface TemplateOption {
  id: string;
  name: string;
  price: number;
  sessions: number | null;
}

export interface TrialInfo {
  id: string;
  status: string;
  branchId: string;
  branchName: string;
  studentName: string;
  nickname: string | null;
  birthDate: string | null;
  parentName: string | null;
  session: SessionSlot | null;
  attendedAt: string | null;
  notes: TrialNotes | null;
  recommendedName: string | null;
  studentId: string | null;
}

/** Trial booking + assessment of one registration (RLS: staff of the branch). */
export async function getTrialInfo(registrationId: string): Promise<TrialInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, status, branch_id, payload, student_id, trial_attended_at, trial_notes, branches(name), profiles!registrations_account_id_fkey(full_name), class_sessions!registrations_trial_session_id_fkey(id, class_date, starts_at, ends_at)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (error) console.error("[getTrialInfo]", error);
  if (!data) return null;

  const p = (data.payload ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" && p[k] !== "" ? (p[k] as string) : null);
  const notes = parseTrialNotes(data.trial_notes);

  let recommendedName: string | null = null;
  if (notes?.recommended_template_id) {
    const { data: tpl, error: tplError } = await supabase
      .from("package_templates")
      .select("name")
      .eq("id", notes.recommended_template_id)
      .maybeSingle();
    if (tplError) console.error("[getTrialInfo] template", tplError);
    recommendedName = tpl?.name ?? null;
  }

  return {
    id: data.id,
    status: data.status,
    branchId: data.branch_id,
    branchName: one(data.branches)?.name ?? "",
    studentName: [str("first_name"), str("last_name")].filter(Boolean).join(" "),
    nickname: str("nickname"),
    birthDate: str("birth_date"),
    parentName: one(data.profiles)?.full_name ?? null,
    session: one(data.class_sessions),
    attendedAt: data.trial_attended_at,
    notes,
    recommendedName,
    studentId: data.student_id,
  };
}

/** Bookable sessions of a branch: date ≥ today (Bangkok), not cancelled, next 21 days. */
export async function listUpcomingSessions(branchId: string): Promise<SessionSlot[]> {
  const supabase = await createClient();
  const today = todayInBangkok();
  const until = todayInBangkok(new Date(Date.now() + 21 * 86_400_000));
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, class_date, starts_at, ends_at")
    .eq("branch_id", branchId)
    .eq("cancelled", false)
    .gte("class_date", today)
    .lte("class_date", until)
    .order("class_date")
    .order("starts_at")
    .limit(100);
  if (error) console.error("[listUpcomingSessions]", error);
  return data ?? [];
}

/** Active package templates of the branch or for every branch. */
export async function listTemplateOptions(branchId: string): Promise<TemplateOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("package_templates")
    .select("id, name, price, sessions")
    .eq("is_active", true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order("sort_order")
    .order("price");
  if (error) console.error("[listTemplateOptions]", error);
  return (data ?? []).map((x) => ({ ...x, price: Number(x.price) }));
}

export interface TrialRow {
  id: string;
  studentName: string;
  nickname: string | null;
  parentName: string | null;
  branchName: string;
  attendedAt: string | null;
  assessed: boolean;
}

export interface TrialGroup {
  session: SessionSlot;
  branchName: string;
  rows: TrialRow[];
}

/** `trial_booked` registrations whose trial class is today or later, grouped by class (soonest first). */
export async function listUpcomingTrials(): Promise<TrialGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, payload, trial_attended_at, trial_notes, branches(name), profiles!registrations_account_id_fkey(full_name), class_sessions!registrations_trial_session_id_fkey!inner(id, class_date, starts_at, ends_at)",
    )
    .eq("status", "trial_booked")
    .gte("class_sessions.class_date", todayInBangkok())
    .order("trial_at");
  if (error) console.error("[listUpcomingTrials]", error);

  const groups = new Map<string, TrialGroup>();
  for (const r of data ?? []) {
    const s = one(r.class_sessions);
    if (!s) continue;
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof p[k] === "string" && p[k] !== "" ? (p[k] as string) : null);
    const branchName = one(r.branches)?.name ?? "";
    const group = groups.get(s.id) ?? { session: s, branchName, rows: [] };
    group.rows.push({
      id: r.id,
      studentName: [str("first_name"), str("last_name")].filter(Boolean).join(" "),
      nickname: str("nickname"),
      parentName: one(r.profiles)?.full_name ?? null,
      branchName,
      attendedAt: r.trial_attended_at,
      assessed: r.trial_notes != null,
    });
    groups.set(s.id, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.session.class_date.localeCompare(b.session.class_date) || a.session.starts_at.localeCompare(b.session.starts_at),
  );
}
