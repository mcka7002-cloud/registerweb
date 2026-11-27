import { type NextRequest } from "next/server";
import { canReadFile, isFileBucket } from "@/lib/files/access";
import { supabaseFileLookup } from "@/lib/files/lookup";
import { getFile } from "@/lib/files/store";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "private, max-age=600", "x-content-type-options": "nosniff" };
const notFound = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

/** GET /files?b=<bucket>&p=<path>: a slip or student photo, for users the access rule allows (404 otherwise). */
export async function GET(request: NextRequest): Promise<Response> {
  const bucket = request.nextUrl.searchParams.get("b") ?? "";
  const path = request.nextUrl.searchParams.get("p") ?? "";
  if (!isFileBucket(bucket)) return notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!(await canReadFile(supabaseFileLookup(supabase), data.user?.id ?? null, bucket, path))) return notFound();

  const object = await getFile(bucket, path);
  if (object) {
    return new Response(object.body, {
      headers: { ...HEADERS, "content-type": object.httpMetadata?.contentType ?? "application/octet-stream" },
    });
  }

  // Files uploaded before the move to R2 are still in Supabase Storage; read them as the user (storage RLS).
  const legacy = await supabase.storage.from(bucket).download(path);
  if (legacy.data) return new Response(legacy.data, { headers: { ...HEADERS, "content-type": legacy.data.type } });
  return notFound();
}
