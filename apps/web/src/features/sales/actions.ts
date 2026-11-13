"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const sellSchema = z.object({
  student_id: z.string().uuid(),
  template_id: z.string().uuid(),
  with_membership: z.boolean(),
  method: z.enum(["cash", "transfer", "promptpay"]),
});
export type SellInput = z.input<typeof sellSchema>;

export interface SellResult {
  order_id: string;
  document_id: string;
  doc_no: string;
  total: number;
}

export async function sellPackage(input: SellInput): Promise<RpcResult<SellResult>> {
  await requireRole(...STAFF_ROLES);
  const parsed = sellSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const res = await callRpc<SellResult>("sell_package", {
    p_student: parsed.data.student_id,
    p_template: parsed.data.template_id,
    p_with_membership: parsed.data.with_membership,
    p_method: parsed.data.method,
  });
  if (res.ok) revalidatePath(`/staff/students/${parsed.data.student_id}`);
  return res;
}
