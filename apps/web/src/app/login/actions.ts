"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/** Local-dev email + password sign-in. Only usable when NEXT_PUBLIC_DEV_LOGIN=1. */
export async function devSignIn(formData: FormData): Promise<void> {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== "1") redirect("/login");

  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("[devSignIn] signInWithPassword failed", error.message);
    redirect("/login?error=credentials");
  }
  redirect("/");
}
