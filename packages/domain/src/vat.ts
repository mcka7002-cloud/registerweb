export interface VatSettings {
  enabled: boolean;
  /** true = ราคาที่ตั้งไว้รวม VAT แล้ว */
  inclusive: boolean;
  /** เปอร์เซ็นต์ เช่น 7 */
  rate: number;
}

export interface VatBreakdown {
  net: number;
  vat: number;
  total: number;
}

const toSatang = (baht: number) => Math.round(baht * 100);
const toBaht = (satang: number) => satang / 100;

/** คำนวณเป็นสตางค์เพื่อเลี่ยงทศนิยมเพี้ยน ต้องตรงกับ public.compute_vat ในฐานข้อมูล */
export function computeVat(price: number, s: VatSettings): VatBreakdown {
  const p = toSatang(price);
  if (!s.enabled) return { net: toBaht(p), vat: 0, total: toBaht(p) };
  if (s.inclusive) {
    const vat = Math.round((p * s.rate) / (100 + s.rate));
    return { net: toBaht(p - vat), vat: toBaht(vat), total: toBaht(p) };
  }
  const vat = Math.round((p * s.rate) / 100);
  return { net: toBaht(p), vat: toBaht(vat), total: toBaht(p + vat) };
}
