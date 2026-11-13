import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatThaiDate, todayInBangkok } from "@/lib/utils";
import type { MyRegistration, RegistrationStatus } from "../queries";

const STATUS_CLASS: Record<RegistrationStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  trial_booked: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  rejected: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
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
