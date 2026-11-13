import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/** Posts to /auth/signout, which clears the session and redirects to /login. */
export async function SignOutButton({ className }: { className?: string }) {
  const t = await getTranslations("auth");
  return (
    <form action="/auth/signout" method="post" className={className}>
      <Button type="submit" variant="outline" size="sm">
        <LogOut />
        <span className="hidden sm:inline">{t("signOut")}</span>
        <span className="sr-only sm:hidden">{t("signOut")}</span>
      </Button>
    </form>
  );
}
