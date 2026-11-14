import Link from "next/link";
import { ClipboardList, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentCard } from "@/features/portal/components/student-card";
import { loadPortal } from "@/features/portal/queries";
import { listMyRegistrations } from "@/features/register/queries";
import { requireRole } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

export default async function PortalPage() {
  const me = await requireRole("customer");
  const t = await getTranslations("portal");
  const [students, registrations] = await Promise.all([loadPortal(me.id), listMyRegistrations(me.id)]);
  const waiting = registrations.filter((r) => r.status === "pending" || r.status === "trial_booked");

  const registerButton = (
    <Button asChild size="lg">
      <Link href="/register">
        <UserPlus /> {t("registerNew")}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} actions={students.length > 0 ? registerButton : null} />

      {waiting.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" /> {t("waiting.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {waiting.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{r.studentName || "—"}</span>
                  <span className="text-muted-foreground">
                    {t("waiting.submitted", { date: formatThaiDate(todayInBangkok(new Date(r.createdAt))) })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t("waiting.hint")}</p>
          </CardContent>
        </Card>
      ) : null}

      {students.length === 0 ? (
        <EmptyState
          title={waiting.length > 0 ? t("empty.waitingTitle") : t("empty.title")}
          description={t("empty.description")}
          action={registerButton}
        />
      ) : (
        students.map((s) => <StudentCard key={s.id} student={s} />)
      )}
    </div>
  );
}
