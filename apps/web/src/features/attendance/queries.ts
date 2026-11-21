import { addDays } from "@registerweb/domain";
import type { Me, Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface SessionTeacher {
  id: string;
  name: string;
}

export interface SessionRow {
  id: string;
  branch_id: string;
  branch: string;
  class_date: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  booked: number;
  checkedIn: number;
  teachers: SessionTeacher[];
  mine: boolean;
}

/** Sessions (not cancelled) from today to today + `days` in my branches (all for admin), with counts and teachers. */
export async function listSessions(me: Me, today: string, days = 7): Promise<SessionRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("class_sessions")
    .select("id, branch_id, class_date, starts_at, ends_at, capacity, branches(code, name)")
    .eq("cancelled", false)
    .gte("class_date", today)
    .lte("class_date", addDays(today, days))
    .order("class_date")
    .order("starts_at");
  if (me.role !== "admin") {
    if (me.branchIds.length === 0) return [];
    query = query.in("branch_id", me.branchIds);
  }
  const { data: sessions, error } = await query;
  if (error) console.error("[listSessions]", error);
  if (!sessions?.length) return [];
  const ids = sessions.map((s) => s.id);

  const [bookingsRes, attRes, teachersRes] = await Promise.all([
    supabase.from("bookings").select("class_session_id").in("class_session_id", ids).in("status", ["booked", "attended"]),
    supabase.from("attendances").select("class_session_id").in("class_session_id", ids).is("voided_at", null),
    supabase
      .from("class_session_teachers")
      .select("class_session_id, teacher_id, profiles!class_session_teachers_teacher_id_fkey(full_name)")
      .in("class_session_id", ids),
  ]);
  if (bookingsRes.error) console.error("[listSessions] bookings", bookingsRes.error);
  if (attRes.error) console.error("[listSessions] attendances", attRes.error);
  if (teachersRes.error) console.error("[listSessions] teachers", teachersRes.error);

  const count = (rows: { class_session_id: string | null }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.class_session_id === id).length;

  const rows = sessions.map((s): SessionRow => {
    const b = one(s.branches);
    const teachers = (teachersRes.data ?? [])
      .filter((t) => t.class_session_id === s.id)
      .map((t) => ({ id: t.teacher_id, name: one(t.profiles)?.full_name ?? "" }));
    return {
      id: s.id,
      branch_id: s.branch_id,
      branch: b ? `${b.code} · ${b.name}` : "",
      class_date: s.class_date,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      capacity: s.capacity,
      booked: count(bookingsRes.data, s.id),
      checkedIn: count(attRes.data, s.id),
      teachers,
      mine: teachers.some((t) => t.id === me.id),
    };
  });
  // Teachers see the classes they teach first; order inside each group stays by date and time.
  return me.role === "teacher" ? [...rows.filter((r) => r.mine), ...rows.filter((r) => !r.mine)] : rows;
}

export interface RosterAttendance {
  id: string;
  method: "scan" | "manual";
  reason: string | null;
  is_trial: boolean;
  recorded_at: string;
  recordedBy: string | null;
  voided_at: string | null;
  void_reason: string | null;
  voidedBy: string | null;
}

export interface RosterStudent {
  id: string;
  code: string;
  name: string;
  nickname: string | null;
  beltRankId: number;
  belt: string | null;
}

export interface RosterRow {
  student: RosterStudent;
  bookingStatus: "booked" | "attended" | "absent" | "cancelled" | null;
  attendances: RosterAttendance[];
}

export interface Roster {
  session: Omit<SessionRow, "booked" | "checkedIn" | "mine"> & { cancelled: boolean };
  rows: RosterRow[];
  booked: number;
  checkedIn: number;
}

const STUDENT_COLS = "id, code, first_name, last_name, nickname, belt_rank_id, belt_ranks(name_th)";

type StudentEmbed = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  belt_rank_id: number;
  belt_ranks: { name_th: string } | { name_th: string }[] | null;
};

const toStudent = (s: StudentEmbed): RosterStudent => ({
  id: s.id,
  code: s.code,
  name: `${s.first_name} ${s.last_name}`,
  nickname: s.nickname,
  beltRankId: s.belt_rank_id,
  belt: one(s.belt_ranks)?.name_th ?? null,
});

/** One session with its bookings (not cancelled) and every check-in (voided ones too), grouped per student. */
export async function getRoster(sessionId: string): Promise<Roster | null> {
  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("class_sessions")
    .select("id, branch_id, class_date, starts_at, ends_at, capacity, cancelled, branches(code, name)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) console.error("[getRoster]", error);
  if (!s) return null;

  const [bookingsRes, attRes, teachersRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(`id, status, student_id, students(${STUDENT_COLS})`)
      .eq("class_session_id", sessionId)
      .neq("status", "cancelled"),
    supabase
      .from("attendances")
      .select(
        `id, student_id, booking_id, method, reason, is_trial, recorded_at, voided_at, void_reason,
         recorder:profiles!attendances_recorded_by_fkey(full_name),
         voider:profiles!attendances_voided_by_fkey(full_name),
         students(${STUDENT_COLS})`,
      )
      .eq("class_session_id", sessionId)
      .order("recorded_at"),
    supabase
      .from("class_session_teachers")
      .select("teacher_id, profiles!class_session_teachers_teacher_id_fkey(full_name)")
      .eq("class_session_id", sessionId),
  ]);
  if (bookingsRes.error) console.error("[getRoster] bookings", bookingsRes.error);
  if (attRes.error) console.error("[getRoster] attendances", attRes.error);
  if (teachersRes.error) console.error("[getRoster] teachers", teachersRes.error);

  const byStudent = new Map<string, RosterRow>();
  for (const b of bookingsRes.data ?? []) {
    const st = one(b.students as StudentEmbed | StudentEmbed[] | null);
    if (!st) continue;
    byStudent.set(b.student_id, { student: toStudent(st), bookingStatus: b.status, attendances: [] });
  }
  for (const a of attRes.data ?? []) {
    let row = byStudent.get(a.student_id);
    if (!row) {
      const st = one(a.students as StudentEmbed | StudentEmbed[] | null);
      if (!st) continue;
      row = { student: toStudent(st), bookingStatus: null, attendances: [] };
      byStudent.set(a.student_id, row);
    }
    row.attendances.push({
      id: a.id,
      method: a.method,
      reason: a.reason,
      is_trial: a.is_trial,
      recorded_at: a.recorded_at,
      recordedBy: one(a.recorder)?.full_name ?? null,
      voided_at: a.voided_at,
      void_reason: a.void_reason,
      voidedBy: one(a.voider)?.full_name ?? null,
    });
  }

  const rows = [...byStudent.values()].sort((x, y) =>
    (x.student.nickname ?? x.student.name).localeCompare(y.student.nickname ?? y.student.name, "th"),
  );
  const b = one(s.branches);
  return {
    session: {
      id: s.id,
      branch_id: s.branch_id,
      branch: b ? `${b.code} · ${b.name}` : "",
      class_date: s.class_date,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      capacity: s.capacity,
      cancelled: s.cancelled,
      teachers: (teachersRes.data ?? []).map((t) => ({ id: t.teacher_id, name: one(t.profiles)?.full_name ?? "" })),
    },
    rows,
    booked: rows.filter((r) => r.bookingStatus === "booked" || r.bookingStatus === "attended").length,
    checkedIn: rows.filter((r) => r.attendances.some((a) => !a.voided_at)).length,
  };
}

export interface BranchStaff {
  id: string;
  name: string;
  role: Role;
}

/** Teachers and managers linked to the branch (profile_branches + profiles), for the class-teachers dialog. */
export async function listBranchStaff(branchId: string): Promise<BranchStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_branches")
    .select("profile_id, profiles!inner(id, full_name, role)")
    .eq("branch_id", branchId)
    .in("profiles.role", ["branch_manager", "teacher"]);
  if (error) console.error("[listBranchStaff]", error);
  return (data ?? [])
    .map((r) => one(r.profiles))
    .filter((p): p is { id: string; full_name: string; role: Role } => p != null)
    .map((p) => ({ id: p.id, name: p.full_name, role: p.role }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "th") : a.role === "teacher" ? -1 : 1));
}
