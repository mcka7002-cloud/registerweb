import { createClient } from "@/lib/supabase/server";
import { todayInBangkok } from "@/lib/utils";

export interface PortalPackage {
  id: string;
  name: string;
  /** null = unlimited */
  sessionsLeft: number | null;
  expiresOn: string | null;
}

export interface PortalSession {
  id: string;
  classDate: string;
  startsAt: string;
  endsAt: string;
}

export interface PortalAttendance {
  id: string;
  scannedAt: string;
  classDate: string | null;
  startsAt: string | null;
  isTrial: boolean;
  manual: boolean;
}

export interface PortalStudent {
  id: string;
  code: string;
  fullName: string;
  nickname: string | null;
  beltName: string | null;
  branchName: string | null;
  membershipExpiresOn: string | null;
  packages: PortalPackage[];
  bookings: PortalSession[];
  attendances: PortalAttendance[];
}

/** Students linked to this account (student_accounts, RLS-scoped) with packages, upcoming bookings and recent attendance. */
export async function loadPortal(accountId: string): Promise<PortalStudent[]> {
  const supabase = await createClient();

  const { data: links, error: linksError } = await supabase
    .from("student_accounts")
    .select("student_id")
    .eq("account_id", accountId);
  if (linksError) console.error("[loadPortal] student_accounts", linksError);
  const ids = (links ?? []).map((l) => l.student_id);
  if (ids.length === 0) return [];

  const today = todayInBangkok();
  const [studentsRes, packagesRes, bookingsRes, attendanceLists] = await Promise.all([
    supabase
      .from("students")
      .select("id, code, first_name, last_name, nickname, membership_expires_on, belt_ranks(name_th), branches(name)")
      .in("id", ids)
      .order("code"),
    supabase
      .from("student_packages")
      .select("id, student_id, name, sessions_total, sessions_used, bonus_sessions, expires_on, created_at")
      .in("student_id", ids)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("bookings")
      .select("id, student_id, class_sessions!inner(id, class_date, starts_at, ends_at)")
      .in("student_id", ids)
      .eq("status", "booked")
      .gte("class_sessions.class_date", today),
    Promise.all(
      ids.map((id) =>
        supabase
          .from("attendances")
          .select("id, student_id, scanned_at, is_trial, method, class_sessions(class_date, starts_at)")
          .eq("student_id", id)
          .is("voided_at", null)
          .order("scanned_at", { ascending: false })
          .limit(10),
      ),
    ),
  ]);
  if (studentsRes.error) console.error("[loadPortal] students", studentsRes.error);
  if (packagesRes.error) console.error("[loadPortal] student_packages", packagesRes.error);
  if (bookingsRes.error) console.error("[loadPortal] bookings", bookingsRes.error);
  attendanceLists.forEach((r) => r.error && console.error("[loadPortal] attendances", r.error));

  return (studentsRes.data ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    fullName: `${s.first_name} ${s.last_name}`,
    nickname: s.nickname,
    beltName: s.belt_ranks?.name_th ?? null,
    branchName: s.branches?.name ?? null,
    membershipExpiresOn: s.membership_expires_on,
    packages: (packagesRes.data ?? [])
      .filter((p) => p.student_id === s.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sessionsLeft: p.sessions_total === null ? null : p.sessions_total + p.bonus_sessions - p.sessions_used,
        expiresOn: p.expires_on,
      })),
    bookings: (bookingsRes.data ?? [])
      .filter((b) => b.student_id === s.id)
      .map((b) => ({
        id: b.id,
        classDate: b.class_sessions.class_date,
        startsAt: b.class_sessions.starts_at,
        endsAt: b.class_sessions.ends_at,
      }))
      .sort((a, b) => (a.classDate + a.startsAt).localeCompare(b.classDate + b.startsAt)),
    attendances: attendanceLists
      .flatMap((r) => r.data ?? [])
      .filter((a) => a.student_id === s.id)
      .map((a) => ({
        id: a.id,
        scannedAt: a.scanned_at,
        classDate: a.class_sessions?.class_date ?? null,
        startsAt: a.class_sessions?.starts_at ?? null,
        isTrial: a.is_trial,
        manual: a.method === "manual",
      })),
  }));
}
