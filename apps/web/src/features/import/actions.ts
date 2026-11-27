"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { callRpc, type RpcResult } from "@/lib/rpc";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, type ImportColumn } from "./csv";

const INVALID_INPUT: RpcResult<never> = { ok: false, code: "INVALID_INPUT" };

const cell = z.string().max(200);
const rowSchema = z.object(
  Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, cell])) as Record<ImportColumn, typeof cell>,
);
const importSchema = z.object({
  branchId: z.guid(),
  rows: z.array(rowSchema).min(1).max(MAX_IMPORT_ROWS),
  commit: z.boolean(),
});
export type ImportInput = z.input<typeof importSchema>;

export interface ImportRowError {
  row: number;
  field: ImportColumn;
  code: string;
}
export interface ImportResult {
  total: number;
  errors: ImportRowError[];
  created: number;
}

/** Validates (`commit: false`) or imports (`commit: true`, all or nothing) the parsed CSV rows via `import_students`. */
export async function importStudents(input: ImportInput): Promise<RpcResult<ImportResult>> {
  await requireRole("admin", "branch_manager");
  if (Array.isArray(input?.rows) && input.rows.length > MAX_IMPORT_ROWS) return { ok: false, code: "TOO_MANY" };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { branchId, rows, commit } = parsed.data;
  const res = await callRpc<ImportResult>("import_students", { p_branch: branchId, p_rows: rows, p_commit: commit });
  if (res.ok && commit && res.data.created > 0) revalidatePath("/staff/students");
  return res;
}

const linkSchema = z.object({
  studentId: z.guid(),
  email: z.string().trim().email(),
});

/** Links an existing customer account (by email) to the student via `link_parent`. */
export async function linkParent(
  input: z.input<typeof linkSchema>,
): Promise<RpcResult<{ account_id: string; full_name: string }>> {
  await requireRole(...STAFF_ROLES);
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const res = await callRpc<{ account_id: string; full_name: string }>("link_parent", {
    p_student: parsed.data.studentId,
    p_email: parsed.data.email,
  });
  if (res.ok) revalidatePath(`/staff/students/${parsed.data.studentId}`);
  return res;
}
