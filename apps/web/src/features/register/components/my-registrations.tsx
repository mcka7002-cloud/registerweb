import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { cn, formatThaiDate, todayInBangkok } from "@/lib/utils";
import type { MyRegistration, RegistrationStatus } from "../queries";

const STATUS_CLASS: Record<RegistrationStatus, string> = {
  pending: "bg-warning text-warning-foreground",
  trial_booked: "bg-accent text-accent-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-accent text-destructive",
};

export async function MyRegistrations({ items }: { items: MyRegistration[] }) {
  const t = await getTranslations("register");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("mine.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={t("mine.empty")} />
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{r.studentName || "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {[r.branchName, t("mine.submittedOn", { date: formatThaiDate(todayInBangkok(new Date(r.createdAt))) })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.trial ? (
                    <p className="mt-2 flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
                      <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        {t("mine.trial", {
                          date: formatThaiDate(r.trial.classDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
                          time: `${r.trial.startsAt.slice(0, 5)}–${r.trial.endsAt.slice(0, 5)}`,
                        })}
                      </span>
                    </p>
                  ) : null}
                  {r.status === "rejected" && r.rejectReason ? (
                    <p className="mt-1 text-sm text-destructive">{t("mine.rejectReason", { reason: r.rejectReason })}</p>
                  ) : null}
                </div>
                <Badge className={cn("shrink-0", STATUS_CLASS[r.status])}>{t(`status.${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
