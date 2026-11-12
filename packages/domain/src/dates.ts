/** วันที่ทั้งหมดในระบบเป็นสตริง YYYY-MM-DD (วันตามเวลาไทย) เพื่อเลี่ยงปัญหา timezone */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export function toEpochDay(d: IsoDate): number {
  return Math.floor(Date.parse(d + "T00:00:00Z") / DAY_MS);
}

export function addDays(d: IsoDate, days: number): IsoDate {
  return new Date((toEpochDay(d) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** วันหมดอายุ = วันเริ่ม + อายุแพ็กเกจ - 1 (นับวันเริ่มเป็นวันที่ 1) */
export function expiryFor(startsOn: IsoDate, durationDays: number): IsoDate {
  return addDays(startsOn, durationDays - 1);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}
