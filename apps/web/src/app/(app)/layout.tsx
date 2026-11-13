import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppNav, type NavItem } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole, type Role } from "@/lib/auth";

type NavKey =
  | "admin"
  | "branches"
  | "schedule"
  | "packages"
  | "users"
  | "staff"
  | "registrations"
  | "students"
  | "kiosk"
  | "portal"
  | "register";

const STAFF_NAV: [string, NavKey][] = [
  ["/staff", "staff"],
  ["/staff/registrations", "registrations"],
  ["/staff/students", "students"],
];

const NAV_BY_ROLE: Partial<Record<Role, [string, NavKey][]>> = {
  admin: [
    ["/admin", "admin"],
    ["/admin/branches", "branches"],
    ["/admin/schedule", "schedule"],
    ["/admin/packages", "packages"],
    ["/admin/users", "users"],
    ...STAFF_NAV,
  ],
  branch_manager: [...STAFF_NAV, ["/kiosk", "kiosk"]],
  teacher: [...STAFF_NAV, ["/kiosk", "kiosk"]],
  customer: [
    ["/portal", "portal"],
    ["/register", "register"],
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole();
  const t = await getTranslations();

  const items: NavItem[] = (NAV_BY_ROLE[me.role] ?? []).map(([href, key]) => ({ href, label: t(`nav.${key}`) }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="shrink-0 font-semibold">
              {t("app.name")}
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right leading-tight">
                <p className="truncate text-sm font-semibold">{me.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{t(`roles.${me.role}`)}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
          {items.length > 0 ? <AppNav items={items} /> : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
