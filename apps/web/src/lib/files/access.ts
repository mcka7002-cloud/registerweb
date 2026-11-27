/**
 * Who may read an uploaded file (slip or student photo). Same rule as the Supabase Storage policies
 * `storage_slips_read` / `storage_photos_read`, but decided through the row-level security of the rows that
 * point at the file, so the rule still lives in Postgres (ADR 0001 §2, ADR 0002).
 */

export const FILE_BUCKETS = ["slips", "student-photos"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^(${UUID})/${UUID}\\.(jpg|png|webp|heic)$`);

/** `<uploader uuid>/<file uuid>.<ext>`: the only shape the upload actions write. Blocks traversal and odd keys. */
export function isValidFilePath(path: string): boolean {
  return PATH_RE.test(path);
}

export function isFileBucket(value: string): value is FileBucket {
  return (FILE_BUCKETS as readonly string[]).includes(value);
}

/** Lookups run with the signed-in user's Supabase client, so RLS decides which rows are visible. */
export interface FileLookup {
  orderWithSlip(path: string): Promise<boolean>;
  registrationWithPhoto(path: string): Promise<boolean>;
  studentWithPhoto(path: string): Promise<boolean>;
}

export async function canReadFile(
  db: FileLookup,
  userId: string | null,
  bucket: FileBucket,
  path: string,
): Promise<boolean> {
  if (!userId || !isFileBucket(bucket) || !isValidFilePath(path)) return false;
  if (path.startsWith(`${userId}/`)) return true; // the uploader's own folder
  if (bucket === "slips") return db.orderWithSlip(path);
  return (await db.registrationWithPhoto(path)) || (await db.studentWithPhoto(path));
}

/** Same-origin URL the browser loads the file from; `/files` checks access on every request. */
export function fileUrl(bucket: FileBucket, path: string): string {
  return `/files?b=${bucket}&p=${encodeURIComponent(path)}`;
}
