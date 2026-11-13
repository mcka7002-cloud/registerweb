import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** วันที่ปัจจุบันตามเวลาไทย ในรูป YYYY-MM-DD */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export function formatThaiDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("th-TH", { ...opts, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
}

export function formatBaht(amount: number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/** Every RPC error code that has Thai text in messages/th/common.json under `errors.<CODE>`. */
export const ERROR_CODES = [
  "FORBIDDEN",
  "NOT_PENDING",
  "REASON_REQUIRED",
  "MEMBERSHIP_REQUIRED",
  "TEMPLATE_INACTIVE",
  "IN_PAST",
  "OUT_OF_WINDOW",
  "TOO_MANY",
  "DUPLICATE",
  "PACKAGE_EXPIRED",
  "NOT_BOOKED",
  "SESSION_UNAVAILABLE",
  "FIELDS_REQUIRED",
  "UNKNOWN",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Message key for an RpcResult code, falling back to UNKNOWN. Use with the root translator: `t(errorKey(res.code))`. */
export function errorKey(code: string): `errors.${ErrorCode}` {
  return `errors.${(ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : "UNKNOWN"}`;
}
