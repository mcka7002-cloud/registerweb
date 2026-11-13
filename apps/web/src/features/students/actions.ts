"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

const INVALID: RpcResult<never> = { ok: false, code: "INVALID_INPUT" };
const uuid = z.string().uuid();
const text = z.string().trim();
const num = z
  .union([z.number(), z.string().trim()])
  .transform((v) => (v === "" ? "" : String(v)))
  .refine((v) => v === "" || !Number.isNaN(Number(v)));

const guardianSchema = z.object({
  full_name: text.min(1),
  nickname: text.optional().default(""),
  relation: text.min(1),
  phones: z.array(text.min(1)).min(1).max(3),
});

const approveSchema = z.object({
  registration_id: uuid,
  student: z.object({
    first_name: text,
    last_name: text,
    first_name_en: text,
    last_name_en: text,
    nickname: text,
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    gender: text,
    height_cm: num,
    weight_kg: num,
    uniform_size: text,
    medical_notes: text,
    emergency_name: text,
    emergency_phone: text,
    guardians: z.array(guardianSchema).max(2),
  }),
});
export type ApproveInput = z.input<typeof approveSchema>;

export async function approveRegistration(input: ApproveInput): Promise<RpcResult<{ student_id: string; code: string }>> {
  await requireRole(...STAFF_ROLES);
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const res = await callRpc<{ student_id: string; code: string }>("approve_registration", {
    p_registration: parsed.data.registration_id,
    p_student: parsed.data.student,
  });
  if (res.ok) {
    revalidatePath("/staff");
    revalidatePath("/staff/registrations");
    revalidatePath("/staff/students");
  }
  return res;
}

const rejectSchema = z.object({ registration_id: uuid, reason: text.min(1) });

export async function rejectRegistration(input: z.input<typeof rejectSchema>): Promise<RpcResult<null>> {
  await requireRole(...STAFF_ROLES);
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "REASON_REQUIRED" };
  const res = await callRpc<null>("reject_registration", {
    p_registration: parsed.data.registration_id,
    p_reason: parsed.data.reason,
  });
  if (res.ok) {
    revalidatePath("/staff");
    revalidatePath("/staff/registrations");
  }
  return res;
}

const updateSchema = z.object({
  student_id: uuid,
  fields: z.object({
    nickname: text,
    first_name: text.min(1),
    last_name: text.min(1),
    first_name_en: text.min(1),
    last_name_en: text.min(1),
    height_cm: num,
    weight_kg: num,
    uniform_size: text,
    medical_notes: text,
    emergency_name: text,
    emergency_phone: text,
  }),
});
export type UpdateStudentInput = z.input<typeof updateSchema>;

export async function updateStudent(input: UpdateStudentInput): Promise<RpcResult<null>> {
  await requireRole(...STAFF_ROLES);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const res = await callRpc<null>("update_student", {
    p_student: parsed.data.student_id,
    p_fields: parsed.data.fields,
  });
  if (res.ok) revalidatePath(`/staff/students/${parsed.data.student_id}`);
  return res;
}
