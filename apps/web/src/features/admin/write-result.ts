import type { RpcResult } from "@/lib/rpc";

type DbError = { code?: string; message?: string } | null;

/** Maps a direct table write's error to RpcResult codes (RLS → FORBIDDEN, unique → CODE_TAKEN). */
export function writeResult<T>(error: DbError, data: T): RpcResult<T> {
  if (!error) return { ok: true, data };
  if (error.code === "42501") return { ok: false, code: "FORBIDDEN" };
  if (error.code === "23505") return { ok: false, code: "CODE_TAKEN" };
  console.error("[admin write]", error);
  return { ok: false, code: "UNKNOWN" };
}

export const INVALID_INPUT: RpcResult<never> = { ok: false, code: "INVALID_INPUT" };
