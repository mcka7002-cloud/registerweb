import type { VatSettings } from "@registerweb/domain";
import type { Database } from "@/lib/database.types";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { todayInBangkok } from "@/lib/utils";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const SIGNED_URL_SECONDS = 600;

// ---------- parent: purchase options ----------

export interface PurchaseTemplate {
  id: string;
  name: string;
  price: number;
  sessions: number | null;
  duration_days: number;
}

export interface PurchaseOptions {
  student: { id: string; code: string; name: string; nickname: string | null; membership_expires_on: string | null };
  membership_required: boolean;
  membership_kind: "new" | "renewal";
  membership_price: number;
  vat: VatSettings;
  payment: { promptpay_id: string | null; bank_account: string | null };
  templates: PurchaseTemplate[];
  pending_order: {
    id: string;
    total: number;
    created_at: string;
    method: PaymentMethod | null;
    items: { description: string; amount: number }[];
  } | null;
}

/** `purchase_options(p_student)`; null when the student is missing or not visible to the caller (FORBIDDEN). */
export async function getPurchaseOptions(studentId: string): Promise<PurchaseOptions | null> {
  const res = await callRpc<PurchaseOptions>("purchase_options", { p_student: studentId });
  if (!res.ok) {
    if (res.code !== "FORBIDDEN") console.error("[getPurchaseOptions]", res.code);
    return null;
  }
  const d = res.data;
  return {
    ...d,
    membership_price: Number(d.membership_price),
    vat: { enabled: d.vat.enabled, inclusive: d.vat.inclusive, rate: Number(d.vat.rate) },
    templates: d.templates.map((t) => ({ ...t, price: Number(t.price) })),
    pending_order: d.pending_order
      ? {
          ...d.pending_order,
          total: Number(d.pending_order.total),
          items: (d.pending_order.items ?? []).map((i) => ({ description: i.description, amount: Number(i.amount) })),
        }
      : null,
  };
}

// ---------- staff: review queue ----------

export interface ReviewItem {
  description: string;
  amount: number;
  student: { code: string; name: string; nickname: string | null } | null;
}

export interface PendingOrder {
  id: string;
  total: number;
  method: PaymentMethod | null;
  created_at: string;
  parent: string | null;
  branch: string | null;
  slipUrl: string | null;
  items: ReviewItem[];
}

export interface RejectedOrder {
  id: string;
  total: number;
  reviewed_at: string | null;
  reason: string | null;
  students: string[];
}

type ItemRow = {
  description: string;
  amount: number;
  students: { code: string; first_name: string; last_name: string; nickname: string | null } | null;
};

function mapItems(rows: ItemRow[] | null | undefined): ReviewItem[] {
  return (rows ?? []).map((i) => {
    const s = one(i.students);
    return {
      description: i.description,
      amount: Number(i.amount),
      student: s ? { code: s.code, name: `${s.first_name} ${s.last_name}`, nickname: s.nickname } : null,
    };
  });
}

function studentLabels(items: ReviewItem[]): string[] {
  return [...new Set(items.flatMap((i) => (i.student ? [`${i.student.code} ${i.student.name}`] : [])))];
}

/** Orders waiting for a slip review in the caller's branches (RLS scopes), newest first, with signed slip URLs. */
export async function listPendingOrders(): Promise<PendingOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, total, pay_method, created_at, slip_path, account:profiles!orders_account_id_fkey(full_name), branches(name), order_items(description, amount, students(code, first_name, last_name, nickname))",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });
  if (error) console.error("[listPendingOrders]", error);
  const rows = data ?? [];

  const paths = rows.flatMap((o) => (o.slip_path ? [o.slip_path] : []));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await supabase.storage.from("slips").createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (signed.error) console.error("[listPendingOrders] signed urls", signed.error);
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((o) => ({
    id: o.id,
    total: Number(o.total),
    method: o.pay_method,
    created_at: o.created_at,
    parent: one(o.account)?.full_name ?? null,
    branch: one(o.branches)?.name ?? null,
    slipUrl: o.slip_path ? (urls.get(o.slip_path) ?? null) : null,
    items: mapItems(o.order_items as ItemRow[]),
  }));
}

/** Orders rejected in the last 7 days in the caller's branches, newest first. */
export async function listRecentRejected(): Promise<RejectedOrder[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, reviewed_at, reject_reason, order_items(description, amount, students(code, first_name, last_name, nickname))")
    .eq("status", "rejected")
    .gte("reviewed_at", since)
    .order("reviewed_at", { ascending: false })
    .limit(20);
  if (error) console.error("[listRecentRejected]", error);
  return (data ?? []).map((o) => ({
    id: o.id,
    total: Number(o.total),
    reviewed_at: o.reviewed_at,
    reason: o.reject_reason,
    students: studentLabels(mapItems(o.order_items as ItemRow[])),
  }));
}

// ---------- staff: today's takings ----------

export interface TodayPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  documentId: string | null;
  docNo: string | null;
  students: string[];
}

export interface TodayTakings {
  payments: TodayPayment[];
  byMethod: { method: PaymentMethod; total: number }[];
  grandTotal: number;
}

/**
 * Payments since midnight Bangkok time that RLS lets the caller read
 * (teacher: received_by = me; manager/admin: the branch).
 */
export async function getTodayTakings(): Promise<TodayTakings> {
  const supabase = await createClient();
  const since = `${todayInBangkok()}T00:00:00+07:00`;
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount, method, paid_at, orders(documents(id, doc_no), order_items(description, amount, students(code, first_name, last_name, nickname)))",
    )
    .gte("paid_at", since)
    .order("paid_at", { ascending: false });
  if (error) console.error("[getTodayTakings]", error);

  const payments: TodayPayment[] = (data ?? []).map((p) => {
    const order = one(p.orders);
    const doc = one(order?.documents);
    return {
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at,
      documentId: doc?.id ?? null,
      docNo: doc?.doc_no ?? null,
      students: studentLabels(mapItems(order?.order_items as ItemRow[] | undefined)),
    };
  });

  const order: PaymentMethod[] = ["cash", "transfer", "promptpay", "slip"];
  const sums = new Map<PaymentMethod, number>();
  for (const p of payments) sums.set(p.method, (sums.get(p.method) ?? 0) + p.amount);
  const byMethod = order
    .filter((m) => m !== "slip" || sums.has(m))
    .map((m) => ({ method: m, total: Math.round((sums.get(m) ?? 0) * 100) / 100 }));
  const grandTotal = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  return { payments, byMethod, grandTotal };
}

