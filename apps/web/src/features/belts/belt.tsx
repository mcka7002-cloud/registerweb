import { beltLook, type BeltColor } from "@registerweb/domain";
import { cn } from "@/lib/utils";

/** Belt colours from Figma page 07 "4 · Belt set" (text on each passes 4.5:1). */
const FILL: Record<BeltColor, string> = {
  white: "#FFFFFF",
  yellow: "#F2C14E",
  green: "#237049",
  blue: "#1F6FB2",
  brown: "#7A4A21",
  red: "#B3261E",
  black: "#231F20",
};
const OUTLINE = "#2A2223";
const GOLD = "#C9A24A";
/** Text colour on a solid belt fill. */
export const onBelt = (c: BeltColor) => (c === "white" || c === "yellow" ? "#2A2223" : "#FFFFFF");
/** Soft tint used behind chips. */
const TINT: Record<BeltColor, string> = {
  white: "#F4F2F2",
  yellow: "#FDF3DA",
  green: "#E0EDE6",
  blue: "#DFEBF5",
  brown: "#EEE6DF",
  red: "#F6E1E0",
  black: "#E5E4E4",
};

const STRIPE_T = [0.84, 0.7, 0.56];
const tailLeft = (t: number) => [27 - 5 * t, 19 + 18 * t];
const tailRight = (t: number) => [33 - 3 * t, 20 + 18 * t];

/** Belt with knot and two tails (64 × 40). Level 1/2 = bars on the tail, Dan = gold bars, Dan 4+ adds a gold number dot. */
export function BeltIcon({ rankId, className, title }: { rankId: number; className?: string; title?: string }) {
  const { color, level, dan } = beltLook(rankId);
  const fill = FILL[color];
  const stripe = dan ? GOLD : color === "yellow" ? OUTLINE : "#FFFFFF";
  const bars = dan ? Math.min(dan, 3) : level;
  return (
    <svg
      viewBox="-2 -8 70 48"
      className={cn("h-5 w-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="2" y="7" width="60" height="10" rx="4" fill={fill} stroke={OUTLINE} strokeWidth="2" />
      <path d="M27 19 L22 37 Q22 38.5 23.5 38.5 L29 38.6 Q30.2 38.6 30.4 37.4 L33 20 Z" fill={fill} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 20 L37.5 36.5 Q38 37.8 39.3 37.4 L44.2 35.6 Q45.4 35.1 44.9 33.9 L37 19 Z" fill={fill} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
      {STRIPE_T.slice(0, bars).map((t) => {
        const [x1, y1] = tailLeft(t);
        const [x2, y2] = tailRight(t);
        return <line key={t} x1={x1 + 0.6} y1={y1} x2={x2 - 0.6} y2={y2} stroke={stripe} strokeWidth="2.4" strokeLinecap="round" />;
      })}
      {color !== "white" ? (
        <g stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round">
          <line x1="6" y1="11" x2="22" y2="11" />
          <line x1="42" y1="11" x2="58" y2="11" />
        </g>
      ) : null}
      <rect x="24" y="4" width="16" height="16" rx="5" fill={fill} stroke={OUTLINE} strokeWidth="2" />
      <path d="M28 9 Q32 13 36 9" stroke={OUTLINE} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.55" />
      {dan >= 4 ? (
        <g>
          <circle cx="57" cy="3" r="9" fill={GOLD} stroke={OUTLINE} strokeWidth="1.5" />
          <text x="57" y="6.5" textAnchor="middle" fontSize="10" fontWeight="600" fill="#231F20" fontFamily="inherit">
            {dan}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/** Small pill for lists and cards: icon + "สายเหลือง 1". `name` is belt_ranks.name_th. */
export function BeltChip({ rankId, name, className }: { rankId: number; name: string; className?: string }) {
  const { color } = beltLook(rankId);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-medium text-foreground",
        color === "white" && "ring-1 ring-[#D9D4D4]",
        className,
      )}
      style={{ backgroundColor: TINT[color] }}
    >
      <BeltIcon rankId={rankId} className="h-4" />
      {name}
    </span>
  );
}

/** Round badge for profile and kiosk: ring in the belt colour, gup/Dan tag, name below. */
export function BeltBadge({
  rankId,
  name,
  tag,
  className,
}: {
  rankId: number;
  name: string;
  /** e.g. "กึบ 10", "ดั้ง 3", "เริ่มต้น" */
  tag: string;
  className?: string;
}) {
  const { color } = beltLook(rankId);
  return (
    <div className={cn("flex w-28 flex-col items-center gap-1.5", className)}>
      <div
        className="flex size-24 items-center justify-center rounded-full border-[6px] bg-white"
        style={{ borderColor: color === "white" ? "#D9D4D4" : FILL[color] }}
      >
        <BeltIcon rankId={rankId} className="h-11" />
      </div>
      <span
        className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", color === "white" && "ring-1 ring-[#D9D4D4]")}
        style={{ backgroundColor: FILL[color], color: onBelt(color) }}
      >
        {tag}
      </span>
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}
