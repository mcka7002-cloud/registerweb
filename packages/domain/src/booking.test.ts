import { describe, expect, it } from "vitest";
import { checkMakeup, validateBookings } from "./booking";
import { expiryFor } from "./dates";

const w = { startsOn: "2026-11-05", expiresOn: expiryFor("2026-11-05", 30), sessionsTotal: 4 };

describe("expiryFor", () => {
  it("30 วันนับวันเริ่มเป็นวันแรก", () => expect(w.expiresOn).toBe("2026-12-04"));
});

describe("validateBookings", () => {
  it("ผ่านเมื่ออยู่ในช่วงและไม่เกินจำนวนครั้ง", () => {
    expect(validateBookings(["2026-11-05", "2026-11-12", "2026-11-19", "2026-12-04"], w, "2026-11-05")).toEqual([]);
  });
  it("จองเกินจำนวนครั้ง", () => {
    const e = validateBookings(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"], w, "2026-11-05");
    expect(e).toContainEqual({ code: "TOO_MANY", max: 4, got: 5 });
  });
  it("วันนอกอายุแพ็กเกจ", () => {
    expect(validateBookings(["2026-12-05"], w, "2026-11-05")).toContainEqual({ code: "OUT_OF_WINDOW", date: "2026-12-05" });
  });
  it("วันซ้ำ", () => {
    expect(validateBookings(["2026-11-10", "2026-11-10"], w, "2026-11-05")).toContainEqual({ code: "DUPLICATE", date: "2026-11-10" });
  });
  it("แบบไม่จำกัดครั้งจองได้หลายวัน", () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 5).padStart(2, "0")}`);
    expect(validateBookings(days, { ...w, sessionsTotal: null }, "2026-11-05")).toEqual([]);
  });
});

describe("checkMakeup", () => {
  const c = { absentDate: "2026-11-10", newDate: "2026-11-20", today: "2026-11-11", window: w, makeupAllowed: 1, makeupUsed: 0, bookedDates: ["2026-11-12"] };
  it("ใช้สิทธิ์ชดเชยได้", () => expect(checkMakeup(c)).toBeNull());
  it("สิทธิ์หมดแล้ว", () => expect(checkMakeup({ ...c, makeupUsed: 1 })).toBe("NO_MAKEUP_LEFT"));
  it("วันใหม่เลยวันหมดอายุ", () => expect(checkMakeup({ ...c, newDate: "2026-12-05" })).toBe("OUT_OF_WINDOW"));
  it("วันใหม่ซ้ำกับวันที่จองแล้ว", () => expect(checkMakeup({ ...c, newDate: "2026-11-12" })).toBe("ALREADY_BOOKED"));
});
