"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";
import { putFile } from "@/lib/files/store";
import { SLIP_MAX_BYTES, SLIP_TYPES } from "./shared";

const purchaseSchema = z.object({
  student_id: z.guid(),
  template_id: z.guid(),
  with_membership: z.enum(["0", "1"]).transform((v) => v === "1"),
  method: z.enum(["transfer", "promptpay"]),
});

export interface PurchaseResult {
  order_id: string;
  total: number;
}

/**
 * Parent submits a purchase with a slip (FormData: student_id, template_id, with_membership "0"|"1",
 * method, slip). Stores the slip in R2 at `slips/<user id>/<uuid>.<ext>`, then calls
 * `request_package_purchase`.
 */
export async function submitPurchase(form: FormData): Promise<RpcResult<PurchaseResult>> {
  const me = await requireRole("customer");
  const parsed = purchaseSchema.safeParse({
    student_id: form.get("student_id"),
    template_id: form.get("template_id"),
    with_membership: form.get("with_membership"),
    method: form.get("method"),
  });
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };

  const slip = form.get("slip");
  if (!(slip instanceof File) || slip.size === 0) return { ok: false, code: "SLIP_REQUIRED" };
  const ext = SLIP_TYPES[slip.type];
  if (!ext || slip.size > SLIP_MAX_BYTES) return { ok: false, code: "SLIP_INVALID" };

  const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
  try {
    await putFile("slips", path, slip);
  } catch (err) {
    console.error("[submitPurchase] upload", err);
    return { ok: false, code: "UPLOAD_FAILED" };
  }

  const res = await callRpc<PurchaseResult>("request_package_purchase", {
    p_student: parsed.data.student_id,
    p_template: parsed.data.template_id,
    p_with_membership: parsed.data.with_membership,
    p_method: parsed.data.method,
    p_slip_path: path,
  });
  if (res.ok) {
    revalidatePath("/portal");
    revalidatePath(`/portal/buy/${parsed.data.student_id}`);
  }
  return res;
}

const reviewSchema = z
  .object({
    order_id: z.guid(),
    approve: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.approve || (v.reason ?? "").length > 0, { message: "REASON_REQUIRED" });
export type ReviewInput = z.input<typeof reviewSchema>;

export interface ReviewResult {
  order_id?: string;
  document_id?: string;
  doc_no?: string;
  total?: number;
}

/** Staff approves (records payment + receipt) or rejects (with a reason) a pending slip order. */
export async function reviewOrder(input: ReviewInput): Promise<RpcResult<ReviewResult>> {
  await requireRole(...STAFF_ROLES);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    const reasonMissing = parsed.error.issues.some((i) => i.message === "REASON_REQUIRED");
    return { ok: false, code: reasonMissing ? "REASON_REQUIRED" : "INVALID_INPUT" };
  }
  const res = await callRpc<ReviewResult>("review_order", {
    p_order: parsed.data.order_id,
    p_approve: parsed.data.approve,
    p_reason: parsed.data.approve ? null : parsed.data.reason,
  });
  if (res.ok) revalidatePath("/staff/payments");
  return res;
}
