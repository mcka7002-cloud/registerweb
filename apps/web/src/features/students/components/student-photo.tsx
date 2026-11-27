import { UserRound } from "lucide-react";
import { fileUrl } from "@/lib/files/access";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** `students.photo_path` for one student (RLS: staff of the branch or a linked customer). */
export async function getStudentPhotoPath(studentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("students").select("photo_path").eq("id", studentId).maybeSingle();
  if (error) console.error("[getStudentPhotoPath]", error);
  return data?.photo_path ?? null;
}

/**
 * Student photo, served by `/files` (lib/files/access decides who may read it). Shows an avatar placeholder
 * when there is no photo.
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
  const url = path ? fileUrl("student-photos", path) : null;

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
      {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked URL; next/image would proxy it without the session */}
      <img src={url} alt={alt} className="size-full object-cover" />
    </div>
  );
}

/** Photo URLs for many paths (for lists); path -> URL. */
export function studentPhotoUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const p of paths) if (p) urls.set(p, fileUrl("student-photos", p));
  return urls;
}

/** Small round photo for table rows; `url` comes from studentPhotoUrls. */
export function StudentThumb({ url, className }: { url: string | null | undefined; className?: string }) {
  const frame = cn(
    "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
    className,
  );
  return url ? (
    <span className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked URL */}
      <img src={url} alt="" className="size-full object-cover" />
    </span>
  ) : (
    <span className={frame} aria-hidden>
      <UserRound className="size-4" />
    </span>
  );
}
