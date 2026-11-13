import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, CalendarDays, Package, Users, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

const LINKS = [
  { href: "/admin/branches", key: "branches", icon: Building2 },
  { href: "/admin/schedule", key: "schedule", icon: CalendarDays },
  { href: "/admin/packages", key: "packages", icon: Package },
  { href: "/admin/users", key: "users", icon: Users },
  { href: "/staff", key: "staff", icon: ClipboardList },
] as const;

export default async function AdminHomePage() {
  await requireRole("admin");
  const t = await getTranslations("admin.hub");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map(({ href, key, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  {t(key)}
                </CardTitle>
                <CardDescription>{t(`${key}Desc`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
