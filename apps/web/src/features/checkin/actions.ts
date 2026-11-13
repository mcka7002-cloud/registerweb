"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";

/** What record_checkin returns (jsonb). `remaining` is null for unlimited packages. */
export interface CheckinResult {
  status: "ok" | "rejected" | "duplicate" | "queued";
  attendance_id?: string;
  problem?: string;
  student?: string | null;
  student_name?: string | null;
  remaining?: number | null;
}

const checkinSchema = z.object({
  clientUuid: z.string().uuid(),
  branchId: z.string().uuid(),
  sessionId: z.string().uuid(),
  barcode: z.string().trim().min(1).max(64),
  scannedAt: z.string().datetime({ offset: true }),
});

export type CheckinInput = z.input<typeof checkinSchema>;

/** Online check-in by scan; every rule lives in record_checkin. */
export async function checkIn(input: CheckinInput): Promise<RpcResult<CheckinResult>> {
  await requireRole("kiosk", "admin", "branch_manager", "teacher");
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "UNKNOWN" };
  const v = parsed.data;

  return callRpc<CheckinResult>("record_checkin", {
    p_client_uuid: v.clientUuid,
    p_branch: v.branchId,
    p_barcode: v.barcode,
    p_scanned_at: v.scannedAt,
    p_class_session: v.sessionId,
    p_source: "online",
    p_method: "scan",
  });
}
