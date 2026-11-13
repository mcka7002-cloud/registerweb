import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Scanner } from "@/features/checkin/components/scanner";
import { listKioskBranches, listSessions } from "@/features/checkin/queries";
import { requireRole } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

const hhmm = (time: string) => time.slice(0, 5);

function KioskFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-8 py-5">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-lg text-muted-foreground">{subtitle}</p> : null}
        </div>
        <SignOutButton />
      </header>
      <main className="flex flex-1 flex-col gap-6 px-8 pb-10">{children}</main>
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
  const { branch: branchParam, session: sessionParam } = await searchParams;

  const branches = await listKioskBranches(me);
  const today = todayInBangkok();
  const todayLabel = t("today", {
    date: formatThaiDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  });

  if (branches.length === 0) {
    return (
      <KioskFrame title={t("title")}>
        <p className="text-2xl text-muted-foreground">{t("noBranches")}</p>
      </KioskFrame>
    );
  }

  const branch = branches.find((b) => b.id === branchParam) ?? (branches.length === 1 ? branches[0] : null);

  if (!branch) {
    return (
      <KioskFrame title={t("chooseBranch")} subtitle={todayLabel}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Button key={b.id} asChild variant="outline" className="h-28 text-3xl">
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
    <KioskFrame title={`${t("chooseSession")} · ${branch.name}`} subtitle={todayLabel}>
      {sessions.length === 0 ? (
        <p className="text-2xl text-muted-foreground">{t("noSessions")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Button key={s.id} asChild className="h-28 text-4xl">
              <Link href={`/kiosk?branch=${branch.id}&session=${s.id}`}>
                {t("time", { start: hhmm(s.startsAt), end: hhmm(s.endsAt) })}
              </Link>
            </Button>
          ))}
        </div>
      )}
      {branches.length > 1 ? (
        <div>
          <Button asChild variant="link" className="px-0 text-lg">
            <Link href="/kiosk">{t("changeBranch")}</Link>
          </Button>
        </div>
      ) : null}
    </KioskFrame>
  );
}
