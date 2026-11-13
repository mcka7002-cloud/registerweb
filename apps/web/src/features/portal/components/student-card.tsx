import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";
import type { PortalStudent } from "../queries";

const hhmm = (time: string) => time.slice(0, 5);

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export async function StudentCard({ student: s }: { student: PortalStudent }) {
  const t = await getTranslations("portal");
  const today = todayInBangkok();
  const exp = s.membershipExpiresOn;
  const membershipState = !exp ? "none" : exp < today ? "expired" : exp <= addDays(today, 30) ? "soon" : "ok";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{s.nickname ? `${s.nickname} · ${s.fullName}` : s.fullName}</CardTitle>
        <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{t("code", { code: s.code })}</span>
          {s.beltName ? <span>{s.beltName}</span> : null}
          {s.branchName ? (
            <span>
              {t("branch")} {s.branchName}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Section title={t("membership.title")}>
          {membershipState === "none" ? (
            <p className="text-sm text-muted-foreground">{t("membership.none")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span>{t("membership.until", { date: formatThaiDate(exp!) })}</span>
              {membershipState === "expired" ? (
                <Badge variant="destructive">
                  <AlertTriangle />
                  {t("membership.expired")}
                </Badge>
              ) : membershipState === "soon" ? (
                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  <AlertTriangle />
                  {t("membership.expiringSoon")}
                </Badge>
              ) : null}
            </div>
          )}
        </Section>

        <Section title={t("packages.title")}>
          {s.packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("packages.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.packages.map((p) => (
                <li key={p.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="shrink-0 font-semibold">
                      {p.sessionsLeft === null ? t("packages.unlimited") : t("packages.left", { count: p.sessionsLeft })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.expiresOn ? t("packages.expires", { date: formatThaiDate(p.expiresOn) }) : t("packages.notStarted")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("bookings.title")}>
          {s.bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("bookings.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {s.bookings.map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <span>{formatThaiDate(b.classDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="text-muted-foreground">{t("time", { start: hhmm(b.startsAt), end: hhmm(b.endsAt) })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("attendances.title")}>
          {s.attendances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("attendances.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {s.attendances.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>
                    {formatThaiDate(a.classDate ?? todayInBangkok(new Date(a.scannedAt)), {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {a.startsAt ? <span className="text-muted-foreground"> {hhmm(a.startsAt)}</span> : null}
                  </span>
                  <span className="flex gap-1">
                    {a.isTrial ? <Badge variant="secondary">{t("attendances.trial")}</Badge> : null}
                    {a.manual ? <Badge variant="outline">{t("attendances.manual")}</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </CardContent>
    </Card>
  );
}
