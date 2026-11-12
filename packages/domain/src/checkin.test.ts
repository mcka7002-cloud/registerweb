import { describe, expect, it } from "vitest";
import { evaluateCheckIn, type PackageSnapshot } from "./checkin";

const pkg = (over: Partial<PackageSnapshot> = {}): PackageSnapshot => ({
  startsOn: "2026-11-05",
  expiresOn: "2026-12-04",
  sessionsTotal: 8,
  sessionsUsed: 2,
  requiresBooking: true,
  status: "active",
  ...over,
});

const base = { today: "2026-11-10", hasBookingToday: true, alreadyCheckedInToday: false };

describe("evaluateCheckIn", () => {
  it("ผ่าน: มีแพ็กเกจ จองวันนี้ และยังเหลือครั้ง", () => {
    expect(evaluateCheckIn({ ...base, pkg: pkg() })).toEqual({ ok: true, remainingAfter: 5 });
  });
  it("ไม่มีแพ็กเกจ", () => {
    expect(evaluateCheckIn({ ...base, pkg: null })).toEqual({ ok: false, reason: "NO_PACKAGE" });
  });
  it("แพ็กเกจยังไม่เริ่ม นับเป็นไม่มีแพ็กเกจ", () => {
    expect(evaluateCheckIn({ ...base, today: "2026-11-04", pkg: pkg() })).toMatchObject({ reason: "NO_PACKAGE" });
  });
  it("หมดอายุตามวันที่ แม้สถานะยัง active (cron ยังไม่รัน)", () => {
    expect(evaluateCheckIn({ ...base, today: "2026-12-05", pkg: pkg() })).toMatchObject({ reason: "EXPIRED" });
  });
  it("วันหมดอายุยังใช้ได้", () => {
    expect(evaluateCheckIn({ ...base, today: "2026-12-04", pkg: pkg() }).ok).toBe(true);
  });
  it("สแกนซ้ำวันเดียวกัน", () => {
    expect(evaluateCheckIn({ ...base, alreadyCheckedInToday: true, pkg: pkg() })).toMatchObject({ reason: "ALREADY_CHECKED_IN" });
  });
  it("ครั้งคงเหลือ = 0", () => {
    expect(evaluateCheckIn({ ...base, pkg: pkg({ sessionsUsed: 8 }) })).toMatchObject({ reason: "NO_SESSIONS_LEFT" });
  });
  it("ไม่ได้จองวันนี้", () => {
    expect(evaluateCheckIn({ ...base, hasBookingToday: false, pkg: pkg() })).toMatchObject({ reason: "NOT_BOOKED" });
  });
  it("ไม่ได้จอง แต่ครูยืนยันให้เข้าเรียน", () => {
    expect(evaluateCheckIn({ ...base, hasBookingToday: false, allowUnbooked: true, pkg: pkg() }).ok).toBe(true);
  });
  it("แพ็กเกจไม่จำกัดครั้ง ไม่มีครั้งคงเหลือ", () => {
    expect(evaluateCheckIn({ ...base, pkg: pkg({ sessionsTotal: null, sessionsUsed: 40 }) })).toEqual({ ok: true, remainingAfter: null });
  });
});
