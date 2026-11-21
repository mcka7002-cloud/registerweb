import { createClient } from "@/lib/supabase/server";
import { AUDIT_PAGE_SIZE, bangkokRange, type AuditFilters } from "./audit";

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function profileNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) console.error("[profileNames]", error);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

export interface AuditRow {
  id: number;
  created_at: string;
  branch: string | null;
  actor: string | null; // full name; null = unknown / system
  actor_id: string | null;
  action: string;
  entity: string;
  data: Record<string, unknown> | null;
}

/** One page of `audit_logs` (admin only through RLS), newest first; `hasNext` when another page exists. */
export async function listAuditLogs(f: AuditFilters): Promise<{ rows: AuditRow[]; hasNext: boolean }> {
  const supabase = await createClient();
  const { gte, lt } = bangkokRange(f.from, f.to);
  const offset = (f.page - 1) * AUDIT_PAGE_SIZE;
  let q = supabase
    .from("audit_logs")
    .select("id, created_at, branch_id, actor_id, action, entity, data, branches(code, name)")
    .gte("created_at", gte)
    .lt("created_at", lt)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + AUDIT_PAGE_SIZE); // one extra row tells whether a next page exists
  if (f.branch) q = q.eq("branch_id", f.branch);
  if (f.action) q = q.eq("action", f.action);
  const { data, error } = await q;
  if (error) console.error("[listAuditLogs]", error);
  const rows = data ?? [];
  const page = rows.slice(0, AUDIT_PAGE_SIZE);
  const names = await profileNames(page.map((r) => r.actor_id));
  return {
    hasNext: rows.length > AUDIT_PAGE_SIZE,
    rows: page.map((r) => {
      const b = one(r.branches);
      return {
        id: r.id,
        created_at: r.created_at,
        branch: b ? b.name : null,
        actor_id: r.actor_id,
        actor: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
        action: r.action,
        entity: r.entity,
        data: r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, unknown>) : null,
      };
    }),
  };
}

export interface VoidInfo {
  status: "issued" | "void";
  reason: string | null;
  requestedAt: string | null;
  requestedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
}

/** Void request / void state of a document (null when RLS hides it). Names only resolve for staff. */
export async function getVoidInfo(documentId: string): Promise<VoidInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("status, void_reason, void_requested_at, void_requested_by, voided_at, voided_by")
    .eq("id", documentId)
    .maybeSingle();
  if (error) console.error("[getVoidInfo]", error);
  if (!data) return null;
  const names = await profileNames([data.void_requested_by, data.voided_by]);
  return {
    status: data.status,
    reason: data.void_reason,
    requestedAt: data.void_requested_at,
    requestedBy: data.void_requested_by ? (names.get(data.void_requested_by) ?? null) : null,
    voidedAt: data.voided_at,
    voidedBy: data.voided_by ? (names.get(data.voided_by) ?? null) : null,
  };
}

export interface VoidRequestRow {
  id: string;
  doc_no: string;
  total: number;
  branch: string | null;
  customer_name: string;
  requested_by: string | null;
  requested_at: string;
  reason: string | null;
}

/** Receipts waiting for the admin to approve or reject a void request, oldest first. */
export async function listVoidRequests(): Promise<VoidRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, doc_no, total, customer_name, void_reason, void_requested_at, void_requested_by, branches(name)")
    .eq("status", "issued")
    .not("void_requested_at", "is", null)
    .order("void_requested_at", { ascending: true });
  if (error) console.error("[listVoidRequests]", error);
  const rows = data ?? [];
  const names = await profileNames(rows.map((r) => r.void_requested_by));
  return rows.map((r) => ({
    id: r.id,
    doc_no: r.doc_no,
    total: Number(r.total),
    branch: one(r.branches)?.name ?? null,
    customer_name: r.customer_name,
    requested_by: r.void_requested_by ? (names.get(r.void_requested_by) ?? null) : null,
    requested_at: r.void_requested_at as string,
    reason: r.void_reason,
  }));
}
