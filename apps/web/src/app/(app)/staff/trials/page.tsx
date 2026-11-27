import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listUpcomingTrials } from "@/features/trial/queries";
import { sessionDate, sessionTime } from "@/features/trial/shared";
import { requireRole } from "@/lib/auth";
import { todayInBangkok } from "@/lib/utils";

export default async function TrialsPage() {
  await requireRole("admin", "branch_manager", "teacher");
  const [t, groups] = await Promise.all([getTranslations("trial"), listUpcomingTrials()]);
  const today = todayInBangkok();

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {groups.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/staff/registrations">{t("openRegistrations")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => {
            const isToday = g.session.class_date === today;
            return (
              <Card key={g.session.id} className={isToday ? "border-primary" : undefined}>
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                  {isToday ? <Badge className="bg-primary text-primary-foreground">{t("today")}</Badge> : null}
                  <CardTitle className="text-lg">
                    {t("classAt", { date: sessionDate(g.session.class_date), time: sessionTime(g.session) })}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {g.branchName} · {t("count", { count: g.rows.length })}
                  </span>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2">
                    {g.rows.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/staff/trials/${r.id}`}
                          className="flex min-h-16 items-center gap-3 rounded-xl bg-muted px-4 py-3 transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                              {r.studentName || "–"}
                              {r.nickname ? <span className="font-normal text-muted-foreground"> ({r.nickname})</span> : null}
                            </p>
                            {r.parentName ? (
                              <p className="text-sm text-muted-foreground">{t("parent", { name: r.parentName })}</p>
                            ) : null}
                          </div>
                          {r.assessed ? (
                            <Badge className={r.attendedAt ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                              {r.attendedAt ? t("assessed") : t("absentBadge")}
                            </Badge>
                          ) : (
                            <Badge className="bg-accent text-accent-foreground">{t("notAssessed")}</Badge>
                          )}
                          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-label={t("assess")} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
