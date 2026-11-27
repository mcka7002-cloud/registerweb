import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const phone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^0\d{8,9}$/));
const optionalPhone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^0\d{8,9}$/)]));

/** Fields of the registration form (FormData entries, as strings). Keys double as error keys in register.json. */
export const registrationSchema = z.object({
  branch_id: z.guid(),
  first_name: text(100),
  last_name: text(100),
  first_name_en: text(100),
  last_name_en: text(100),
  nickname: optionalText(50),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !Number.isNaN(Date.parse(v)) && v >= "1900-01-01" && Date.parse(v) <= Date.now()),
  gender: z.enum(["", "male", "female"]).transform((v) => (v === "" ? null : v)),
  height_cm: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 50 && v <= 250)),
  medical_notes: optionalText(1000),
  guardian_name: text(200),
  relation: text(50),
  phone1: phone,
  phone2: optionalPhone,
  phone3: optionalPhone,
  pdpa_consent: z.literal("on"),
  publish_consent: z.literal("on").optional(),
});

/** Optional student photo (a File entry, checked separately from the string fields). Matches bucket `student-photos`. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
} as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const PHOTO_ACCEPT = [...Object.keys(PHOTO_TYPES), ".heic"].join(",");

/** MIME type of an allowed photo, or null. Some browsers send HEIC with an empty type, so fall back to the name. */
export function photoType(file: { type: string; name: string }): PhotoType | null {
  if (file.type in PHOTO_TYPES) return file.type as PhotoType;
  if (file.type === "" && /\.heic$/i.test(file.name)) return "image/heic";
  return null;
}

export type RegistrationField = keyof typeof registrationSchema.shape | "photo";

export type RegisterResult =
  | { ok: true; data: { id: string } }
  | { ok: false; code: "INVALID_INPUT"; fields: RegistrationField[] }
  | { ok: false; code: "UPLOAD_FAILED"; fields: ["photo"] }
  | { ok: false; code: string; fields?: undefined };
