import { cache } from "react";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type Role = Database["public"]["Enums"]["app_role"];

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branchIds: string[];
}

/** Roles that work in the back office. */
export const STAFF_ROLES: Role[] = ["admin", "branch_manager", "teacher"];

/** Home page per role; used by `/`. */
export function homePathFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "branch_manager":
    case "teacher":
      return "/staff";
    case "customer":
      return "/portal";
    case "kiosk":
      return "/kiosk";
    default:
      return "/login";
  }
}

const loadMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, branchesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").eq("id", user.id).maybeSingle(),
    supabase.from("profile_branches").select("branch_id").eq("profile_id", user.id),
  ]);
  if (profileRes.error) console.error("[getMe] profiles", profileRes.error);
  if (branchesRes.error) console.error("[getMe] profile_branches", branchesRes.error);

  const profile = profileRes.data as { id: string; full_name: string; email: string; role: Role } | null;
  if (!profile) return null;
  const branches = (branchesRes.data ?? []) as { branch_id: string }[];

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    branchIds: branches.map((b) => b.branch_id),
  };
});

/** The signed-in user with profile and branches; null when signed out or without a profile. Cached per request. */
export async function getMe(): Promise<Me | null> {
  return loadMe();
}

/**
 * Returns the signed-in user when their role is one of `roles` (any role when none are given).
 * Redirects to /login when signed out and to / when the role is not allowed.
 */
export async function requireRole(...roles: Role[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (roles.length > 0 && !roles.includes(me.role)) redirect("/");
  return me;
}
