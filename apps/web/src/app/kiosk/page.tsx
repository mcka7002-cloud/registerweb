import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo, Mascot } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Scanner } from "@/features/checkin/components/scanner";
import { listKioskBranches, listSessions } from "@/features/checkin/queries";
import { requireRole } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

const hhmm = (time: string) => time.slice(0, 5);

function KioskFrame({
  title,
  subtitle,
  logoAlt,
  children,
}: {
  title: string;
  subtitle?: string;
  logoAlt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="flex items-center justify-between gap-4 bg-background px-8 py-4">
        <BrandLogo alt={logoAlt} priority className="h-12" />
        {subtitle ? <p className="text-lg text-muted-foreground">{subtitle}</p> : null}
        <SignOutButton />
      </header>
      <main className="flex flex-1 flex-col gap-8 px-12 py-10">
        <div className="flex items-center gap-5">
          <Mascot className="h-28" />
          <h1 className="font-heading text-4xl">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; session?: string }>;
}) {
  const me = await requireRole("kiosk", "admin", "branch_manager", "teacher");
  const t = await getTranslations("checkin");
  const logoAlt = (await getTranslations("app"))("logoAlt");
  const { branch: branchParam, session: sessionParam } = await searchParams;

  const branches = await listKioskBranches(me);
  const today = todayInBangkok();
  const todayLabel = t("today", {
    date: formatThaiDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  });

  if (branches.length === 0) {
    return (
      <KioskFrame title={t("title")} logoAlt={logoAlt}>
        <p className="text-2xl text-muted-foreground">{t("noBranches")}</p>
      </KioskFrame>
    );
  }

  const branch = branches.find((b) => b.id === branchParam) ?? (branches.length === 1 ? branches[0] : null);

  if (!branch) {
    return (
      <KioskFrame title={t("chooseBranch")} subtitle={todayLabel} logoAlt={logoAlt}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Button key={b.id} asChild variant="outline" className="h-28 rounded-[2rem] font-heading text-3xl">
              <Link href={`/kiosk?branch=${b.id}`}>{b.name}</Link>
            </Button>
          ))}
        </div>
      </KioskFrame>
    );
  }

  const sessions = await listSessions(branch.id, today);
  const session = sessions.find((s) => s.id === sessionParam);

  if (session) {
    return (
      <Scanner
        key={session.id}
        branchId={branch.id}
        sessionId={session.id}
        heading={`${branch.name} · ${t("time", { start: hhmm(session.startsAt), end: hhmm(session.endsAt) })}`}
        changeSessionHref={`/kiosk?branch=${branch.id}`}
      />
    );
  }

  return (
    <KioskFrame title={`${t("chooseSession")} · ${branch.name}`} subtitle={todayLabel} logoAlt={logoAlt}>
      {sessions.length === 0 ? (
        <p className="text-2xl text-muted-foreground">{t("noSessions")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Button key={s.id} asChild className="h-28 rounded-[2rem] font-heading text-4xl">
              <Link href={`/kiosk?branch=${branch.id}&session=${s.id}`}>
                {t("time", { start: hhmm(s.startsAt), end: hhmm(s.endsAt) })}
              </Link>
            </Button>
          ))}
        </div>
      )}
      {branches.length > 1 ? (
        <div>
          <Button asChild variant="outline" size="lg" className="h-12">
            <Link href="/kiosk">{t("changeBranch")}</Link>
          </Button>
        </div>
      ) : null}
    </KioskFrame>
  );
}
