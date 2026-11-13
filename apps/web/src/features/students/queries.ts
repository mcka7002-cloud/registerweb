import { createClient } from "@/lib/supabase/server";

export interface Guardian {
  full_name: string;
  nickname?: string | null;
  relation: string;
  phones: string[];
}

/** Registration form fields (registrations.payload); every key is optional because the form owns it. */
export interface RegistrationPayload {
  first_name?: string;
  last_name?: string;
  first_name_en?: string;
  last_name_en?: string;
  nickname?: string;
  birth_date?: string;
  gender?: string;
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
  uniform_size?: string;
  medical_notes?: string;
  emergency_name?: string;
  emergency_phone?: string;
  guardians?: Guardian[];
  [key: string]: unknown;
}

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface RegistrationListRow {
  id: string;
  status: string;
  created_at: string;
  trial_at: string | null;
  branch: string;
  studentName: string;
  nickname: string | null;
  parentName: string | null;
}

/** Pending + trial_booked registrations visible to me (RLS: staff of the branch). */
export async function listOpenRegistrations(): Promise<RegistrationListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, status, created_at, trial_at, payload, branches(name), profiles!registrations_account_id_fkey(full_name)")
    .in("status", ["pending", "trial_booked"])
    .order("created_at");
  if (error) console.error("[listOpenRegistrations]", error);
  return (data ?? []).map((r) => {
    const p = (r.payload ?? {}) as RegistrationPayload;
    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      trial_at: r.trial_at,
      branch: one(r.branches)?.name ?? "",
      studentName: [p.first_name, p.last_name].filter(Boolean).join(" "),
      nickname: p.nickname ?? null,
      parentName: one(r.profiles)?.full_name ?? null,
    };
  });
}

export async function countOpenRegistrations(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "trial_booked"]);
  if (error) console.error("[countOpenRegistrations]", error);
  return count ?? 0;
}

export async function getRegistration(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, status, created_at, trial_at, payload, pdpa_consent, publish_consent, reject_reason, student_id, branches(name, code), profiles!registrations_account_id_fkey(full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[getRegistration]", error);
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    created_at: data.created_at,
    trial_at: data.trial_at,
    pdpa_consent: data.pdpa_consent,
    publish_consent: data.publish_consent,
    reject_reason: data.reject_reason,
    student_id: data.student_id,
    payload: (data.payload ?? {}) as RegistrationPayload,
    branch: one(data.branches),
    parent: one(data.profiles),
  };
}

export interface StudentListRow {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  status: string;
  membership_expires_on: string | null;
  branch: string;
}

/** Search by Thai/English name, nickname or code (RLS keeps it to my branches). */
export async function searchStudents(q: string): Promise<StudentListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("id, code, first_name, last_name, nickname, status, membership_expires_on, branches(code)")
    .is("anonymized_at", null)
    .order("code")
    .limit(50);
  // PostgREST `or` uses commas/parentheses as syntax; strip them from the user's text.
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      ["code", "first_name", "last_name", "nickname", "first_name_en", "last_name_en"]
        .map((c) => `${c}.ilike.${like}`)
        .join(","),
    );
  }
  const { data, error } = await query;
  if (error) console.error("[searchStudents]", error);
  return (data ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    first_name: s.first_name,
    last_name: s.last_name,
    nickname: s.nickname,
    status: s.status,
    membership_expires_on: s.membership_expires_on,
    branch: one(s.branches)?.code ?? "",
  }));
}

export async function getStudent(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, branch_id, code, first_name, last_name, first_name_en, last_name_en, nickname, birth_date, gender, height_cm, weight_kg, uniform_size, medical_notes, emergency_name, emergency_phone, membership_expires_on, status, exam_counter, branches(name, code), belt_ranks(name_th), guardians(id, full_name, nickname, relation, phones, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[getStudent]", error);
  if (!data) return null;
  const { branches, belt_ranks, guardians, ...student } = data;
  return {
    ...student,
    height_cm: student.height_cm == null ? null : Number(student.height_cm),
    weight_kg: student.weight_kg == null ? null : Number(student.weight_kg),
    branch: one(branches),
    belt: one(belt_ranks)?.name_th ?? null,
    guardians: [...(guardians ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}
export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudent>>>;

export interface StudentPackageRow {
  id: string;
  branch_id: string;
  name: string;
  sessions_total: number | null;
  sessions_used: number;
  bonus_sessions: number;
  /** total + bonus − used; null = unlimited */
  remaining: number | null;
  paid_on: string;
  starts_on: string | null;
  expires_on: string | null;
  must_start_by: string;
  status: string;
}

export async function listStudentPackages(studentId: string): Promise<StudentPackageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_packages")
    .select("id, branch_id, name, sessions_total, sessions_used, bonus_sessions, paid_on, starts_on, expires_on, must_start_by, status")
    .eq("student_id", studentId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) console.error("[listStudentPackages]", error);
  return (data ?? []).map((p) => ({
    ...p,
    remaining: p.sessions_total == null ? null : p.sessions_total + p.bonus_sessions - p.sessions_used,
  }));
}
