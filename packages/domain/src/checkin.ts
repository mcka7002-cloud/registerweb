import type { IsoDate } from "./dates";

/**
 * กฎตรวจสิทธิ์ตอนเช็คชื่อ (ขั้นที่ 4 ในแท็บ Technical flow)
 * ฐานข้อมูลตรวจซ้ำอีกครั้งในฟังก์ชัน public.check_in เสมอ ฟังก์ชันนี้ใช้แสดงผลและทดสอบกฎ
 * ลำดับการตรวจต้องตรงกับ supabase/migrations/*_check_in.sql
 */
export type CheckInFailure =
  | "NO_PACKAGE"
  | "EXPIRED"
  | "ALREADY_CHECKED_IN"
  | "NO_SESSIONS_LEFT"
  | "NOT_BOOKED";

export interface PackageSnapshot {
  startsOn: IsoDate;
  expiresOn: IsoDate;
  /** null = ไม่จำกัดครั้ง */
  sessionsTotal: number | null;
  sessionsUsed: number;
  requiresBooking: boolean;
  status: "active" | "expired" | "cancelled";
}

export interface CheckInContext {
  today: IsoDate;
  pkg: PackageSnapshot | null;
  hasBookingToday: boolean;
  alreadyCheckedInToday: boolean;
  /** ครูยืนยันให้เข้าเรียนแม้ไม่ได้จองวันนี้ (key-in เท่านั้น) */
  allowUnbooked?: boolean;
}

export type CheckInDecision =
  | { ok: true; remainingAfter: number | null }
  | { ok: false; reason: CheckInFailure };

export function evaluateCheckIn(ctx: CheckInContext): CheckInDecision {
  const { pkg, today } = ctx;
  if (!pkg || pkg.status === "cancelled" || today < pkg.startsOn) return { ok: false, reason: "NO_PACKAGE" };
  if (pkg.status === "expired" || today > pkg.expiresOn) return { ok: false, reason: "EXPIRED" };
  if (ctx.alreadyCheckedInToday) return { ok: false, reason: "ALREADY_CHECKED_IN" };
  if (pkg.sessionsTotal !== null && pkg.sessionsUsed >= pkg.sessionsTotal) return { ok: false, reason: "NO_SESSIONS_LEFT" };
  if (pkg.requiresBooking && !ctx.hasBookingToday && !ctx.allowUnbooked) return { ok: false, reason: "NOT_BOOKED" };
  return { ok: true, remainingAfter: pkg.sessionsTotal === null ? null : pkg.sessionsTotal - pkg.sessionsUsed - 1 };
}

export const checkInMessages: Record<CheckInFailure, string> = {
  NO_PACKAGE: "ยังไม่มีแพ็กเกจที่ใช้ได้ กรุณาติดต่อครู",
  EXPIRED: "แพ็กเกจหมดอายุแล้ว กรุณาต่อแพ็กเกจ",
  ALREADY_CHECKED_IN: "เช็คชื่อวันนี้ไปแล้ว",
  NO_SESSIONS_LEFT: "ใช้ครั้งเรียนครบแล้ว กรุณาต่อแพ็กเกจ",
  NOT_BOOKED: "วันนี้ไม่ได้จองไว้ ให้ครูตัดสินใจและเช็คชื่อแทน",
};
