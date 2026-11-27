import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { FileBucket } from "./access";

/** The part of the R2 binding API we use (keeps Workers types out of the Next.js type space). */
interface R2Object {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}
interface R2BucketLike {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
}

/** R2 bucket bound as `FILES` in wrangler.jsonc (a local emulation under `next dev` and `preview`). */
function filesBucket(): R2BucketLike {
  const bucket = (getCloudflareContext().env as unknown as { FILES?: R2BucketLike }).FILES;
  if (!bucket) throw new Error("R2 binding FILES is missing (wrangler.jsonc)");
  return bucket;
}

const key = (bucket: FileBucket, path: string) => `${bucket}/${path}`;

export async function putFile(bucket: FileBucket, path: string, file: File): Promise<void> {
  await filesBucket().put(key(bucket, path), await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
}

export async function getFile(bucket: FileBucket, path: string): Promise<R2Object | null> {
  return filesBucket().get(key(bucket, path));
}
