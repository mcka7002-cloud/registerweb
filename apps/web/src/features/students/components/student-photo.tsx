import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const BUCKET = "student-photos";
const SIGNED_URL_SECONDS = 600;

/** `students.photo_path` for one student (RLS: staff of the branch or a linked customer). */
export async function getStudentPhotoPath(studentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("students").select("photo_path").eq("id", studentId).maybeSingle();
  if (error) console.error("[getStudentPhotoPath]", error);
  return data?.photo_path ?? null;
}

/**
 * Student photo from the private `student-photos` bucket, shown through a short-lived signed URL
 * (storage policy storage_photos_read decides who may sign it). Falls back to an avatar placeholder.
 */
export async function StudentPhoto({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  let url: string | null = null;
  if (path) {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) console.error("[StudentPhoto] createSignedUrl failed", error);
    url = data?.signedUrl ?? null;
  }

  const frame = cn(
    "flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
    className,
  );
  if (!url) {
    return (
      <div className={frame} role="img" aria-label={alt}>
        <UserRound className="size-1/2" aria-hidden />
      </div>
    );
  }
  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs change every render, next/image would not cache them */}
      <img src={url} alt={alt} className="size-full object-cover" />
    </div>
  );
}
