import type { Me } from "@/lib/auth";

/**
 * Whether to show "เช็คชื่อแทน" (display only; `staff_checkin` makes the real decision):
 * admin; manager of the branch; a teacher of the branch who is assigned, or any branch teacher when nobody is assigned.
 */
export function showStaffCheckin(me: Me, session: { branch_id: string; teachers: { id: string }[] }): boolean {
  if (me.role === "admin") return true;
  const inBranch = me.branchIds.includes(session.branch_id);
  if (me.role === "branch_manager") return inBranch;
  if (me.role === "teacher") return inBranch && (session.teachers.length === 0 || session.teachers.some((t) => t.id === me.id));
  return false;
}

/** "17:00:00" → "17:00" */
export const hhmm = (time: string) => time.slice(0, 5);
