/** Belt ranks as stored in belt_ranks (id 0–20). Pure mapping used by the belt icon, chip and badge. */
export type BeltColor = "white" | "yellow" | "green" | "blue" | "brown" | "red" | "black";

export interface BeltLook {
  color: BeltColor;
  /** 1 or 2 within a colour (gup belts), 0 for white and black */
  level: 0 | 1 | 2;
  /** 1–10 for black belts, otherwise 0 */
  dan: number;
  /** gup number (10 → 1) for coloured belts, otherwise null */
  gup: number | null;
}

const COLOURED: BeltColor[] = ["yellow", "green", "blue", "brown", "red"];

export function beltLook(rankId: number): BeltLook {
  if (!Number.isInteger(rankId) || rankId < 0 || rankId > 20) throw new RangeError(`unknown belt rank ${rankId}`);
  if (rankId === 0) return { color: "white", level: 0, dan: 0, gup: null };
  if (rankId <= 10) {
    const i = rankId - 1;
    return { color: COLOURED[Math.floor(i / 2)], level: (i % 2) + 1 as 1 | 2, dan: 0, gup: 11 - rankId };
  }
  return { color: "black", level: 0, dan: rankId - 10, gup: null };
}

/** Classes still needed before the next exam (never negative). */
export function classesToExam(attended: number, required: number): number {
  return Math.max(0, required - attended);
}
