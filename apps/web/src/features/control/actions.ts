"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const requestSchema = z.object({
  document_id: z.guid(),
  reason: z.string().trim().max(500),
});
export type RequestVoidInput = z.input<typeof requestSchema>;

/** Staff asks the admin to void a receipt (reason required) → `request_void_document`. */
export async function requestVoid(input: RequestVoidInput): Promise<RpcResult<Record<string, never>>> {
  await requireRole(...STAFF_ROLES);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "BAD_INPUT" };
  if (parsed.data.reason === "") return { ok: false, code: "REASON_REQUIRED" };
  const res = await callRpc<Record<string, never>>("request_void_document", {
    p_document: parsed.data.document_id,
    p_reason: parsed.data.reason,
  });
  if (res.ok) {
    revalidatePath(`/receipts/${parsed.data.document_id}`);
    revalidatePath("/admin/queue");
  }
  return res;
}

const reviewSchema = z.object({
  document_id: z.guid(),
  approve: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
export type ReviewVoidInput = z.input<typeof reviewSchema>;

/** Admin approves (receipt → void) or rejects (reason required) a void request → `review_void_document`. */
export async function reviewVoid(input: ReviewVoidInput): Promise<RpcResult<Record<string, never>>> {
  await requireRole("admin");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "BAD_INPUT" };
  const reason = parsed.data.reason ?? "";
  if (!parsed.data.approve && reason === "") return { ok: false, code: "REASON_REQUIRED" };
  const res = await callRpc<Record<string, never>>("review_void_document", {
    p_document: parsed.data.document_id,
    p_approve: parsed.data.approve,
    p_reason: reason === "" ? null : reason,
  });
  if (res.ok) {
    revalidatePath("/admin/queue");
    revalidatePath(`/receipts/${parsed.data.document_id}`);
  }
  return res;
}
