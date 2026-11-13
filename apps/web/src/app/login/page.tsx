import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMe, homePathFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { devSignIn } from "./actions";
import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await getMe();
  if (me) redirect(homePathFor(me.role));

  // Signed in but no profile row: let the user sign out instead of looping.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await searchParams;
  const t = await getTranslations("auth");
  const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === "1";
  const errorText =
    error === "credentials" ? t("invalidCredentials") : error === "oauth" ? t("oauthFailed") : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorText ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorText}
            </p>
          ) : null}

          {user ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">{t("noProfile")}</p>
              <SignOutButton />
            </div>
          ) : (
            <GoogleSignInButton />
          )}

          {devLogin && !user ? (
            <form action={devSignIn} className="flex flex-col gap-3 border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground">{t("devTitle")}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" variant="secondary">
                {t("submit")}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
