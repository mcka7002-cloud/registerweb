import { beltLook } from "@registerweb/domain";

/** Tag under a belt badge: "เริ่มต้น" for white, "กึบ N" for coloured belts, "ดั้ง N" for black. */
export function beltTag(rankId: number, labels: { start: string; gup: (n: number) => string; dan: (n: number) => string }) {
  const { gup, dan } = beltLook(rankId);
  if (dan) return labels.dan(dan);
  if (gup) return labels.gup(gup);
  return labels.start;
}
