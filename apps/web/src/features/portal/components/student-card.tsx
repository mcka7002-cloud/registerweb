import Link from "next/link";
import { AlertTriangle, ChevronDown, Clock, ShoppingCart, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBaht, formatThaiDate, todayInBangkok } from "@/lib/utils";
import type { PortalStudent } from "../queries";

const hhmm = (time: string) => time.slice(0, 5);
const longDate = { weekday: "short", day: "numeric", month: "short", year: "numeric" } as const;

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

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

/** One student: a short summary that is always visible, and the full history behind "ดูรายละเอียด". */
export async function StudentCard({ student: s, photo }: { student: PortalStudent; photo?: React.ReactNode }) {
  const t = await getTranslations("portal");
  const today = todayInBangkok();
  const exp = s.membershipExpiresOn;
  const membershipState = !exp ? "none" : exp < today ? "expired" : exp <= addDays(today, 30) ? "soon" : "ok";
  const unlimited = s.packages.some((p) => p.sessionsLeft === null);
  const sessionsLeft = s.packages.reduce((sum, p) => sum + (p.sessionsLeft ?? 0), 0);
  const next = s.bookings[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        {photo}
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl">{s.nickname ? `${s.nickname} · ${s.fullName}` : s.fullName}</CardTitle>
          <CardDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>{t("code", { code: s.code })}</span>
            {s.beltName ? <span>{s.beltName}</span> : null}
            {s.branchName ? (
              <span>
                {t("branch")} {s.branchName}
              </span>
            ) : null}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Fact label={t("membership.title")}>
            {membershipState === "none" ? (
              <span className="text-muted-foreground">{t("membership.none")}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {t("membership.until", { date: formatThaiDate(exp!) })}
                {membershipState === "expired" ? (
                  <Badge variant="destructive">
                    <AlertTriangle />
                    {t("membership.expired")}
                  </Badge>
                ) : membershipState === "soon" ? (
                  <Badge className="bg-amber-100 text-amber-900">
                    <AlertTriangle />
                    {t("membership.expiringSoon")}
                  </Badge>
                ) : null}
              </span>
            )}
          </Fact>
          <Fact label={t("summary.sessions")}>
            {s.packages.length === 0
              ? t("packages.empty")
              : unlimited
                ? t("packages.unlimited")
                : t("packages.left", { count: sessionsLeft })}
          </Fact>
          <Fact label={t("summary.nextClass")}>
            {next ? (
              <>
                {formatThaiDate(next.classDate, longDate)}{" "}
                <span className="text-muted-foreground">{hhmm(next.startsAt)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("bookings.empty")}</span>
            )}
          </Fact>
        </div>

        {s.order?.status === "pending_review" ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Clock className="mt-0.5 size-4 shrink-0" />
            {t("order.pending", {
              total: formatBaht(s.order.total),
              date: formatThaiDate(todayInBangkok(new Date(s.order.createdAt))),
            })}
          </p>
        ) : s.order?.status === "rejected" ? (
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {t("order.rejected", { reason: s.order.rejectReason ?? "" })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11 w-full sm:h-9 sm:w-auto">
            <Link href={`/portal/buy/${s.id}`}>
              <ShoppingCart /> {t("buy")}
            </Link>
          </Button>
        </div>

        <details className="group rounded-md border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 min-h-11 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("details")}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-6 border-t p-3 md:grid-cols-2">
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
                          {p.sessionsLeft === null
                            ? t("packages.unlimited")
                            : t("packages.left", { count: p.sessionsLeft })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.expiresOn
                          ? t("packages.expires", { date: formatThaiDate(p.expiresOn) })
                          : t("packages.notStarted")}
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
                      <span>{formatThaiDate(b.classDate, longDate)}</span>
                      <span className="text-muted-foreground">
                        {t("time", { start: hhmm(b.startsAt), end: hhmm(b.endsAt) })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">{t("bookings.hint")}</p>
            </Section>

            <Section title={t("attendances.title")}>
              {s.attendances.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("attendances.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {s.attendances.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span>
                        {formatThaiDate(a.classDate ?? todayInBangkok(new Date(a.scannedAt)), longDate)}
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
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
