import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];

export interface BranchOption {
  id: string;
  name: string;
}

export interface MyRegistration {
  id: string;
  status: RegistrationStatus;
  createdAt: string;
  rejectReason: string | null;
  branchName: string | null;
  studentName: string;
}

export async function listBranches(): Promise<BranchOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("branches").select("id, name").order("code");
  if (error) console.error("[listBranches]", error);
  return data ?? [];
}

/** Registrations submitted by this account (RLS `registrations_own`), newest first. */
export async function listMyRegistrations(accountId: string): Promise<MyRegistration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, status, created_at, reject_reason, payload, branches(name)")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) console.error("[listMyRegistrations]", error);

  return (data ?? []).map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
    const name = [str("first_name"), str("last_name")].filter(Boolean).join(" ");
    const nickname = str("nickname");
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      rejectReason: r.reject_reason,
      branchName: r.branches?.name ?? null,
      studentName: nickname ? `${name} (${nickname})` : name,
    };
  });
}
