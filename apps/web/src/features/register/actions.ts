"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { registrationSchema, type RegisterResult, type RegistrationField } from "./schema";

const KEYS = Object.keys(registrationSchema.shape) as RegistrationField[];

/** Inserts a pending registration for the signed-in account (RLS policy `registrations_insert`). */
export async function submitRegistration(_prev: RegisterResult | null, formData: FormData): Promise<RegisterResult> {
  const me = await requireRole();

  const raw: Record<string, string> = {};
  for (const key of KEYS) {
    const value = formData.get(key);
    if (typeof value === "string") raw[key] = value;
    else if (key !== "publish_consent" && key !== "pdpa_consent") raw[key] = "";
  }

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path[0] as RegistrationField))];
    return { ok: false, code: "INVALID_INPUT", fields };
  }
  const f = parsed.data;

  // Keys match what approve_registration reads from payload.
  const payload = {
    first_name: f.first_name,
    last_name: f.last_name,
    first_name_en: f.first_name_en,
    last_name_en: f.last_name_en,
    nickname: f.nickname,
    birth_date: f.birth_date,
    gender: f.gender,
    height_cm: f.height_cm,
    medical_notes: f.medical_notes,
    guardians: [
      {
        full_name: f.guardian_name,
        relation: f.relation,
        phones: [f.phone1, f.phone2, f.phone3].filter((p) => p !== ""),
      },
    ],
  } satisfies Json;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      branch_id: f.branch_id,
      account_id: me.id,
      payload,
      pdpa_consent: true,
      publish_consent: f.publish_consent === "on",
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[submitRegistration] insert failed", error);
    return { ok: false, code: "UNKNOWN" };
  }

  revalidatePath("/register");
  return { ok: true, data: { id: data.id } };
}
