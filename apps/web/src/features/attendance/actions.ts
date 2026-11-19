"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const uuid = z.string().uuid();
const reason = z.string().trim().min(1).max(500);

function refresh(sessionId: string) {
  revalidatePath(`/staff/sessions/${sessionId}`);
  revalidatePath("/staff/sessions");
  revalidatePath("/staff");
}

const checkinSchema = z.object({ client_uuid: uuid, session_id: uuid, student_id: uuid, reason });

/** Result of `record_checkin` as returned through `staff_checkin`. */
export interface StaffCheckinResult {
  status: "ok" | "rejected" | "duplicate" | "queued";
  problem?: string;
  attendance_id?: string;
  student?: string | null;
  student_name?: string;
  remaining?: number | null;
}

/** Staff checks a booked student in without a card scan (reason required). The DB decides who may and whether it counts. */
export async function staffCheckin(input: z.input<typeof checkinSchema>): Promise<RpcResult<StaffCheckinResult>> {
  await requireRole(...STAFF_ROLES);
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) {
    const reasonMissing = parsed.error.issues.some((i) => i.path[0] === "reason");
    return { ok: false, code: reasonMissing ? "REASON_REQUIRED" : "INVALID_INPUT" };
  }
  const res = await callRpc<StaffCheckinResult>("staff_checkin", {
    p_client_uuid: parsed.data.client_uuid,
    p_session: parsed.data.session_id,
    p_student: parsed.data.student_id,
    p_reason: parsed.data.reason,
  });
  if (res.ok && res.data.status === "ok") refresh(parsed.data.session_id);
  return res;
}

const voidSchema = z.object({ session_id: uuid, attendance_id: uuid, reason });

/** Admin cancels a check-in (reason required): the DB gives back the session, exam count and booking status. */
export async function voidAttendance(input: z.input<typeof voidSchema>): Promise<RpcResult<Record<string, never>>> {
  await requireRole("admin");
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    const reasonMissing = parsed.error.issues.some((i) => i.path[0] === "reason");
    return { ok: false, code: reasonMissing ? "REASON_REQUIRED" : "INVALID_INPUT" };
  }
  const res = await callRpc<Record<string, never>>("void_attendance", {
    p_attendance: parsed.data.attendance_id,
    p_reason: parsed.data.reason,
  });
  if (res.ok) refresh(parsed.data.session_id);
  return res;
}

const teachersSchema = z.object({ session_id: uuid, teacher_ids: z.array(uuid).max(50), whole_schedule: z.boolean() });

/** Admin / branch manager replaces the teachers of a session (or of its weekly slot from today on). */
export async function setSessionTeachers(input: z.input<typeof teachersSchema>): Promise<RpcResult<{ sessions: number }>> {
  await requireRole("admin", "branch_manager");
  const parsed = teachersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const res = await callRpc<{ sessions: number }>("set_session_teachers", {
    p_session: parsed.data.session_id,
    p_teachers: parsed.data.teacher_ids,
    p_whole_schedule: parsed.data.whole_schedule,
  });
  if (res.ok) refresh(parsed.data.session_id);
  return res;
}
