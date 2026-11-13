import { createClient } from "@/lib/supabase/server";

export type RpcResult<T> = { ok: true; data: T } | { ok: false; code: string };

const ERROR_CODE = /^[A-Z_]+$/;

type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

/**
 * Calls a Postgres function as the signed-in user (server side only).
 * A rule violation raised with an upper-snake message (e.g. `NOT_PENDING`) becomes `{ ok: false, code }`;
 * anything else is logged here and returned as `UNKNOWN`.
 */
export async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  try {
    const supabase = await createClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
    const { data, error } = await rpc(fn, args);
    if (error) {
      const message = (error.message ?? "").trim();
      if (ERROR_CODE.test(message)) return { ok: false, code: message };
      console.error(`[callRpc] ${fn} failed`, error);
      return { ok: false, code: "UNKNOWN" };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    console.error(`[callRpc] ${fn} threw`, err);
    return { ok: false, code: "UNKNOWN" };
  }
}
