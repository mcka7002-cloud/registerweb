import { describe, expect, it } from "vitest";
import { computeVat } from "./vat";

describe("computeVat", () => {
  it("ปิด VAT", () => expect(computeVat(2500, { enabled: false, inclusive: true, rate: 7 })).toEqual({ net: 2500, vat: 0, total: 2500 }));
  it("ราคารวม VAT แล้ว", () => expect(computeVat(2500, { enabled: true, inclusive: true, rate: 7 })).toEqual({ net: 2336.45, vat: 163.55, total: 2500 }));
  it("ราคายังไม่รวม VAT", () => expect(computeVat(2500, { enabled: true, inclusive: false, rate: 7 })).toEqual({ net: 2500, vat: 175, total: 2675 }));
  it("ปัดเศษเป็นสตางค์", () => expect(computeVat(1800, { enabled: true, inclusive: true, rate: 7 })).toEqual({ net: 1682.24, vat: 117.76, total: 1800 }));
});
