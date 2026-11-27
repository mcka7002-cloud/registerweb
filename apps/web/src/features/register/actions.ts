"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Json } from "@/lib/database.types";
import { putFile } from "@/lib/files/store";
import { createClient } from "@/lib/supabase/server";
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  photoType,
  registrationSchema,
  type RegisterResult,
  type RegistrationField,
} from "./schema";

const KEYS = Object.keys(registrationSchema.shape) as (keyof typeof registrationSchema.shape)[];

/** Inserts a pending registration for the signed-in account (RLS policy `registrations_insert`). */
export async function submitRegistration(_prev: RegisterResult | null, formData: FormData): Promise<RegisterResult> {
  const me = await requireRole();

  const raw: Record<string, string> = {};
  for (const key of KEYS) {
    const value = formData.get(key);
    if (typeof value === "string") raw[key] = value;
    else if (key !== "publish_consent" && key !== "pdpa_consent") raw[key] = "";
  }

  // An empty file input arrives as a File with size 0: treat it as "no photo".
  const photoEntry = formData.get("photo");
  const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
  const photoMime = photo ? photoType(photo) : null;
  const photoInvalid = photo != null && (photoMime == null || photo.size > PHOTO_MAX_BYTES);

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success || photoInvalid) {
    const fields: RegistrationField[] = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => i.path[0] as RegistrationField))];
    if (photoInvalid) fields.push("photo");
    return { ok: false, code: "INVALID_INPUT", fields };
  }
  const f = parsed.data;
  const supabase = await createClient();

  // Upload first, into the applicant's own folder (approve_registration only copies paths from that folder).
  let photo_path: string | null = null;
  if (photo && photoMime) {
    const path = `${me.id}/${crypto.randomUUID()}.${PHOTO_TYPES[photoMime]}`;
    try {
      await putFile("student-photos", path, new File([photo], photo.name, { type: photoMime }));
    } catch (err) {
      console.error("[submitRegistration] photo upload failed", err);
      return { ok: false, code: "UPLOAD_FAILED", fields: ["photo"] };
    }
    photo_path = path;
  }

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
    photo_path,
    guardians: [
      {
        full_name: f.guardian_name,
        relation: f.relation,
        phones: [f.phone1, f.phone2, f.phone3].filter((p) => p !== ""),
      },
    ],
  } satisfies Json;

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
