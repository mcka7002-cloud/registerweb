"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error("[login] signInWithOAuth failed", error);
      toast.error(t("oauthFailed"));
      setPending(false);
    }
  }

  return (
    <Button type="button" size="lg" className="w-full" onClick={signIn} disabled={pending}>
      {pending ? t("signingIn") : t("google")}
    </Button>
  );
}
