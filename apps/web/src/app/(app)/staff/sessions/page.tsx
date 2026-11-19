import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listSessions, type SessionRow } from "@/features/attendance/queries";
import { hhmm } from "@/features/attendance/shared";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

export default async function SessionsPage() {
  const me = await requireRole(...STAFF_ROLES);
  const today = todayInBangkok();
  const [t, sessions] = await Promise.all([getTranslations("attendance.list"), listSessions(me, today)]);
  const isTeacher = me.role === "teacher";
  const mine = sessions.filter((s) => s.mine);
  const groups: { title: string | null; rows: SessionRow[] }[] =
    isTeacher && mine.length > 0
      ? [
          { title: t("mine"), rows: mine },
          { title: t("others"), rows: sessions.filter((s) => !s.mine) },
        ]
      : [{ title: null, rows: sessions }];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {sessions.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="grid gap-8">
          {groups
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <section key={g.title ?? "all"} className="grid gap-3">
                {g.title ? <h2 className="text-lg font-semibold">{g.title}</h2> : null}
                <ul className="grid gap-3">
                  {g.rows.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/staff/sessions/${s.id}`}
                        aria-label={`${t("openRoster")} ${formatThaiDate(s.class_date, { weekday: "long", day: "numeric", month: "long" })} ${hhmm(s.starts_at)}`}
                        className="block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <Card className="py-4 transition-colors hover:bg-muted/60">
                          <CardContent className="flex flex-col gap-3 px-5 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                                <CalendarDays className="size-6" aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-semibold">
                                  {formatThaiDate(s.class_date, { weekday: "long", day: "numeric", month: "long" })}
                                  {s.class_date === today ? <Badge className="bg-warning text-warning-foreground">{t("today")}</Badge> : null}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="tabular-nums">
                                    {hhmm(s.starts_at)}–{hhmm(s.ends_at)}
                                  </span>{" "}
                                  · {s.branch}
                                </p>
                                <p className="mt-1 text-sm">
                                  <span className="text-muted-foreground">{t("teachers")}: </span>
                                  {s.teachers.length > 0 ? s.teachers.map((x) => x.name).join(", ") : <span className="text-muted-foreground">{t("noTeachers")}</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:justify-end">
                              <div className="rounded-xl bg-muted px-3 py-1.5 text-center">
                                <p className="text-xs text-muted-foreground">{t("booked")}</p>
                                <p className="font-semibold tabular-nums">
                                  {s.booked}
                                  {s.capacity ? <span className="font-normal text-muted-foreground">/{s.capacity}</span> : null}
                                </p>
                              </div>
                              <div className="rounded-xl bg-success px-3 py-1.5 text-center text-success-foreground">
                                <p className="text-xs">{t("checkedIn")}</p>
                                <p className="font-semibold tabular-nums">{s.checkedIn}</p>
                              </div>
                              <ChevronRight className="ml-auto size-5 text-muted-foreground sm:ml-0" aria-hidden />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
