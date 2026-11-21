import { createClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "student-photos";
const SIGNED_URL_SECONDS = 600;

export interface CardStudent {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  firstNameEn: string;
  lastNameEn: string;
  nickname: string | null;
  beltRankId: number;
  beltName: string | null;
  branchName: string | null;
  /** Short-lived signed URL of the photo, null when there is none. */
  photoUrl: string | null;
}

/**
 * One student for the card, read with the user's client: RLS lets a linked customer
 * (students_customer) or staff of the branch (students_staff) see it; anyone else gets null.
 */
export async function getCardStudent(id: string): Promise<CardStudent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, code, first_name, last_name, first_name_en, last_name_en, nickname, photo_path, belt_rank_id, belt_ranks(name_th), branches(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[getCardStudent]", error);
  if (!data) return null;

  let photoUrl: string | null = null;
  if (data.photo_path) {
    const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(data.photo_path, SIGNED_URL_SECONDS);
    if (signed.error) console.error("[getCardStudent] createSignedUrl", signed.error);
    photoUrl = signed.data?.signedUrl ?? null;
  }

  return {
    id: data.id,
    code: data.code,
    firstName: data.first_name,
    lastName: data.last_name,
    firstNameEn: data.first_name_en,
    lastNameEn: data.last_name_en,
    nickname: data.nickname,
    beltRankId: data.belt_rank_id,
    beltName: data.belt_ranks?.name_th ?? null,
    branchName: data.branches?.name ?? null,
    photoUrl,
  };
}
