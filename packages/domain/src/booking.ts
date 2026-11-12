import { type IsoDate } from "./dates";

export interface BookingWindow {
  startsOn: IsoDate;
  expiresOn: IsoDate;
  /** null = ไม่จำกัดครั้ง */
  sessionsTotal: number | null;
}

export type BookingError =
  | { code: "OUT_OF_WINDOW"; date: IsoDate }
  | { code: "DUPLICATE"; date: IsoDate }
  | { code: "TOO_MANY"; max: number; got: number }
  | { code: "IN_PAST"; date: IsoDate };

/** ตรวจรายการวันที่จองตอนขายแพ็กเกจ (ทุกแพ็กเกจต้องจองวันภายในอายุแพ็กเกจ) */
export function validateBookings(dates: IsoDate[], w: BookingWindow, today: IsoDate): BookingError[] {
  const errors: BookingError[] = [];
  const seen = new Set<IsoDate>();
  for (const d of dates) {
    if (seen.has(d)) errors.push({ code: "DUPLICATE", date: d });
    seen.add(d);
    if (d < w.startsOn || d > w.expiresOn) errors.push({ code: "OUT_OF_WINDOW", date: d });
    else if (d < today) errors.push({ code: "IN_PAST", date: d });
  }
  if (w.sessionsTotal !== null && seen.size > w.sessionsTotal) {
    errors.push({ code: "TOO_MANY", max: w.sessionsTotal, got: seen.size });
  }
  return errors;
}

export interface MakeupContext {
  absentDate: IsoDate;
  newDate: IsoDate;
  today: IsoDate;
  window: BookingWindow;
  makeupAllowed: number;
  makeupUsed: number;
  bookedDates: IsoDate[];
}

export type MakeupError = "NO_MAKEUP_LEFT" | "OUT_OF_WINDOW" | "IN_PAST" | "ALREADY_BOOKED";

/** ขาดวันที่จอง → เลือกวันใหม่ได้ตามสิทธิ์ชดเชย (ค่าเริ่มต้น 1 ครั้งต่อแพ็กเกจ) ภายในอายุแพ็กเกจ */
export function checkMakeup(c: MakeupContext): MakeupError | null {
  if (c.makeupUsed >= c.makeupAllowed) return "NO_MAKEUP_LEFT";
  if (c.newDate < c.window.startsOn || c.newDate > c.window.expiresOn) return "OUT_OF_WINDOW";
  if (c.newDate < c.today) return "IN_PAST";
  if (c.bookedDates.includes(c.newDate)) return "ALREADY_BOOKED";
  return null;
}
