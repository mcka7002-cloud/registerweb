import type { VatSettings } from "@registerweb/domain";
import { createClient } from "@/lib/supabase/server";

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export interface SaleTemplate {
  id: string;
  name: string;
  price: number;
  sessions: number | null;
  duration_days: number;
}

export interface SaleContext {
  templates: SaleTemplate[];
  vat: VatSettings;
  membership: { new: number; renewal: number };
}

/** What the sell dialog needs for a branch: active templates, VAT settings, membership prices (display only). */
export async function getSaleContext(branchId: string): Promise<SaleContext> {
  const supabase = await createClient();
  const [templatesRes, settingsRes, pricesRes] = await Promise.all([
    supabase
      .from("package_templates")
      .select("id, name, price, sessions, duration_days, branch_id")
      .eq("is_active", true)
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order("sort_order")
      .order("price"),
    supabase.from("branch_settings").select("vat_enabled, vat_inclusive, vat_rate").eq("branch_id", branchId).maybeSingle(),
    supabase
      .from("price_settings")
      .select("branch_id, key, amount")
      .in("key", ["membership_new", "membership_renewal"])
      .or(`branch_id.is.null,branch_id.eq.${branchId}`),
  ]);
  if (templatesRes.error) console.error("[getSaleContext] templates", templatesRes.error);
  if (settingsRes.error) console.error("[getSaleContext] settings", settingsRes.error);
  if (pricesRes.error) console.error("[getSaleContext] prices", pricesRes.error);

  // Same precedence as sell_package: the branch's own price first, then the school-wide one.
  const price = (key: string) => {
    const rows = (pricesRes.data ?? []).filter((r) => r.key === key);
    const row = rows.find((r) => r.branch_id === branchId) ?? rows.find((r) => r.branch_id === null);
    return Number(row?.amount ?? 0);
  };
  const s = settingsRes.data;

  return {
    templates: (templatesRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      sessions: t.sessions,
      duration_days: t.duration_days,
    })),
    vat: {
      enabled: s?.vat_enabled ?? false,
      inclusive: s?.vat_inclusive ?? true,
      rate: Number(s?.vat_rate ?? 0),
    },
    membership: { new: price("membership_new"), renewal: price("membership_renewal") },
  };
}

/** Receipt document + its order items + branch; null when RLS hides it or it does not exist. */
export async function getReceipt(id: string) {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      "id, doc_type, doc_no, order_id, issued_at, customer_name, customer_tax_id, customer_address, subtotal, vat_rate, vat_inclusive, vat_amount, total, status, branches(name, code, address, tax_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[getReceipt]", error);
  if (!doc) return null;

  const [itemsRes, paymentRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, description, qty, unit_price, discount, amount, students(code, first_name, last_name)")
      .eq("order_id", doc.order_id),
    // payments are visible to managers/admin only; the method is shown when readable.
    supabase.from("payments").select("method").eq("order_id", doc.order_id).limit(1),
  ]);
  if (itemsRes.error) console.error("[getReceipt] items", itemsRes.error);

  const { branches, ...rest } = doc;
  return {
    ...rest,
    subtotal: Number(doc.subtotal),
    vat_rate: Number(doc.vat_rate),
    vat_amount: Number(doc.vat_amount),
    total: Number(doc.total),
    branch: one(branches),
    paymentMethod: paymentRes.data?.[0]?.method ?? null,
    items: (itemsRes.data ?? []).map((i) => ({
      id: i.id,
      description: i.description,
      qty: i.qty,
      unit_price: Number(i.unit_price),
      discount: Number(i.discount),
      amount: Number(i.amount),
      student: one(i.students),
    })),
  };
}
