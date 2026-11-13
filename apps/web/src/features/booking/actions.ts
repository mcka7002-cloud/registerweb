"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const uuid = z.string().uuid();

const bookSchema = z.object({
  student_id: uuid,
  package_id: uuid,
  session_ids: z.array(uuid).min(1),
});

export async function bookSessions(input: z.input<typeof bookSchema>): Promise<RpcResult<{ booked: number }>> {
  await requireRole(...STAFF_ROLES);
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const res = await callRpc<{ booked: number }>("book_sessions", {
    p_package: parsed.data.package_id,
    p_sessions: parsed.data.session_ids,
  });
  if (res.ok) {
    revalidatePath(`/staff/students/${parsed.data.student_id}`);
    revalidatePath("/staff");
  }
  return res;
}

const cancelSchema = z.object({ student_id: uuid, booking_id: uuid });

export async function cancelBooking(input: z.input<typeof cancelSchema>): Promise<RpcResult<null>> {
  await requireRole(...STAFF_ROLES);
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const res = await callRpc<null>("cancel_booking", { p_booking: parsed.data.booking_id });
  if (res.ok) {
    revalidatePath(`/staff/students/${parsed.data.student_id}`);
    revalidatePath("/staff");
  }
  return res;
}
