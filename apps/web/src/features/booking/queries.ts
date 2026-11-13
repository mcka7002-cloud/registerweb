import { addDays } from "@registerweb/domain";
import { createClient } from "@/lib/supabase/server";

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface TodaySession {
  id: string;
  branch: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  booked: number;
  attended: number;
}

/** Today's (not cancelled) class sessions in the given branches, with booking counts (bookings via RLS). */
export async function listTodaySessions(branchIds: string[] | "all", today: string): Promise<TodaySession[]> {
  const supabase = await createClient();
  let query = supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, capacity, branches(code, name)")
    .eq("class_date", today)
    .eq("cancelled", false)
    .order("starts_at");
  if (branchIds !== "all") {
    if (branchIds.length === 0) return [];
    query = query.in("branch_id", branchIds);
  }
  const { data: sessions, error } = await query;
  if (error) console.error("[listTodaySessions]", error);
  if (!sessions?.length) return [];

  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("class_session_id, status")
    .in(
      "class_session_id",
      sessions.map((s) => s.id),
    )
    .in("status", ["booked", "attended"]);
  if (bErr) console.error("[listTodaySessions] bookings", bErr);

  return sessions.map((s) => {
    const mine = (bookings ?? []).filter((b) => b.class_session_id === s.id);
    const attended = mine.filter((b) => b.status === "attended").length;
    const b = one(s.branches);
    return {
      id: s.id,
      branch: b ? `${b.code} · ${b.name}` : "",
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      capacity: s.capacity,
      // "booked" counts everyone with a seat (still booked or already attended)
      booked: mine.length,
      attended,
    };
  });
}

export interface SessionOption {
  id: string;
  class_date: string;
  starts_at: string;
  ends_at: string;
}

/** Upcoming class sessions of a branch for the booking dialog (today .. +days). */
export async function listUpcomingSessions(branchId: string, today: string, days = 60): Promise<SessionOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, class_date, starts_at, ends_at")
    .eq("branch_id", branchId)
    .eq("cancelled", false)
    .gte("class_date", today)
    .lte("class_date", addDays(today, days))
    .order("class_date")
    .order("starts_at");
  if (error) console.error("[listUpcomingSessions]", error);
  return data ?? [];
}

export interface StudentBooking {
  id: string;
  status: string;
  student_package_id: string;
  class_session_id: string;
  class_date: string;
  starts_at: string;
  ends_at: string;
}

/** The student's bookings with class date today or later (any status but cancelled). */
export async function listUpcomingBookings(studentId: string, today: string): Promise<StudentBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, status, student_package_id, class_session_id, class_sessions!inner(class_date, starts_at, ends_at)")
    .eq("student_id", studentId)
    .neq("status", "cancelled")
    .gte("class_sessions.class_date", today);
  if (error) console.error("[listUpcomingBookings]", error);
  return (data ?? [])
    .map((b) => {
      const s = one(b.class_sessions);
      return {
        id: b.id,
        status: b.status,
        student_package_id: b.student_package_id,
        class_session_id: b.class_session_id,
        class_date: s?.class_date ?? "",
        starts_at: s?.starts_at ?? "",
        ends_at: s?.ends_at ?? "",
      };
    })
    .sort((a, b) => (a.class_date + a.starts_at).localeCompare(b.class_date + b.starts_at));
}
