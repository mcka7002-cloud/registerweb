"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const INVALID: RpcResult<never> = { ok: false, code: "INVALID_INPUT" };

function revalidateTrial(registrationId: string) {
  revalidatePath("/staff");
  revalidatePath("/staff/registrations");
  revalidatePath(`/staff/registrations/${registrationId}`);
  revalidatePath("/staff/trials");
  revalidatePath(`/staff/trials/${registrationId}`);
  revalidatePath("/register");
  revalidatePath("/portal");
}

const bookSchema = z.object({ registration_id: z.string().uuid(), session_id: z.string().uuid() });

export async function bookTrial(input: z.input<typeof bookSchema>): Promise<RpcResult<{ trial_at: string }>> {
  await requireRole(...STAFF_ROLES);
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const res = await callRpc<{ trial_at: string }>("book_trial", {
    p_registration: parsed.data.registration_id,
    p_session: parsed.data.session_id,
  });
  if (res.ok) revalidateTrial(parsed.data.registration_id);
  return res;
}

const score = z.number().int().min(1).max(5);
const recordSchema = z
  .object({
    registration_id: z.string().uuid(),
    attended: z.boolean(),
    scores: z.object({
      flexibility: score.nullable(),
      strength: score.nullable(),
      focus: score.nullable(),
      listening: score.nullable(),
    }),
    note: z.string().trim().max(2000),
    recommended_template_id: z.string().uuid().nullable(),
  })
  .refine((v) => !v.attended || Object.values(v.scores).every((s) => s != null));

export type RecordTrialInput = z.input<typeof recordSchema>;

export async function recordTrial(input: RecordTrialInput): Promise<RpcResult<null>> {
  await requireRole(...STAFF_ROLES);
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { registration_id, attended, scores, note, recommended_template_id } = parsed.data;
  const res = await callRpc<null>("record_trial", {
    p_registration: registration_id,
    p_attended: attended,
    p_notes: { scores: attended ? scores : null, note, recommended_template_id },
  });
  if (res.ok) revalidateTrial(registration_id);
  return res;
}
