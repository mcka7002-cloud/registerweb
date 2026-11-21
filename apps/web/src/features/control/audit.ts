import { todayInBangkok } from "@/lib/utils";

/** Every `audit_logs.action` the migrations write; each has a Thai label at `control.audit.actions.<action>`. */
export const AUDIT_ACTIONS = [
  "checkin",
  "void_checkin",
  "approve",
  "reject",
  "update",
  "generate_sessions",
  "set_session_teachers",
  "sell_package",
  "request_purchase",
  "approve_slip",
  "reject_slip",
  "book",
  "cancel",
  "book_trial",
  "record_trial",
  "request_void",
  "reject_void",
  "void_document",
  "import_students",
  "link_parent",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = [
  "attendances",
  "registrations",
  "students",
  "class_sessions",
  "orders",
  "student_packages",
  "bookings",
  "documents",
] as const;

/** `data` keys shown in the details column (in this order); ids are left out. */
export const AUDIT_FIELDS = [
  "doc_no",
  "total",
  "method",
  "source",
  "code",
  "sessions",
  "whole_schedule",
  "teachers",
  "trial_at",
  "attended",
  "created",
  "from",
  "to",
  "with_membership",
  "packages",
  "request_reason",
  "reason",
  "note",
] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];

export const AUDIT_PAGE_SIZE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditFilters {
  from: string; // YYYY-MM-DD, Bangkok
  to: string; // YYYY-MM-DD, Bangkok (inclusive)
  branch: string | null;
  action: AuditAction | null;
  page: number; // 1-based
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Reads the URL search params; defaults to the last 7 days (Bangkok) and page 1. Bad values fall back. */
export function parseAuditFilters(sp: Record<string, string | string[] | undefined>, now: Date = new Date()): AuditFilters {
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const today = todayInBangkok(now);
  const to = DATE.test(get("to")) ? get("to") : today;
  const from = DATE.test(get("from")) ? get("from") : addDays(to, -6);
  const branch = UUID.test(get("branch")) ? get("branch") : null;
  const action = (AUDIT_ACTIONS as readonly string[]).includes(get("action")) ? (get("action") as AuditAction) : null;
  const page = Math.max(1, Math.min(10000, Number.parseInt(get("page"), 10) || 1));
  return { from, to, branch, action, page };
}

/** Bangkok day range → [start, end) timestamps with offset. */
export function bangkokRange(from: string, to: string): { gte: string; lt: string } {
  return { gte: `${from}T00:00:00+07:00`, lt: `${addDays(to, 1)}T00:00:00+07:00` };
}

/** Query string for a filter set (page 1 is left out). */
export function auditHref(f: AuditFilters, page: number): string {
  const q = new URLSearchParams({ from: f.from, to: f.to });
  if (f.branch) q.set("branch", f.branch);
  if (f.action) q.set("action", f.action);
  if (page > 1) q.set("page", String(page));
  return `/admin/audit?${q.toString()}`;
}
