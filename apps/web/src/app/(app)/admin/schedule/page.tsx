import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BranchPicker } from "@/features/admin/components/branch-picker";
import {
  AddScheduleDialog,
  GenerateSessionsButton,
  ToggleScheduleButton,
} from "@/features/admin/components/schedule-controls";
import { listBranchOptions, listSchedules, upcomingSessionSummary } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  await requireRole("admin");
  const t = await getTranslations("admin.schedule");
  const branches = await listBranchOptions();
  if (branches.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState title={t("noBranch")} />
      </>
    );
  }

  const { branch } = await searchParams;
  const branchId = branches.find((b) => b.id === branch)?.id ?? branches[0].id;
  const today = todayInBangkok();
  const [schedules, summary] = await Promise.all([listSchedules(branchId), upcomingSessionSummary(branchId, today)]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<BranchPicker branches={branches} value={branchId} label={t("branch")} />}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("upcoming", { count: summary.count })}
          {summary.lastDate ? ` ${t("upcomingUntil", { date: formatThaiDate(summary.lastDate) })}` : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <AddScheduleDialog branchId={branchId} />
          <GenerateSessionsButton branchId={branchId} />
        </div>
      </div>
      {schedules.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("weekday")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("capacity")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id} className={s.is_active ? undefined : "text-muted-foreground"}>
                    <TableCell className="font-medium">{t(`days.${s.weekday}`)}</TableCell>
                    <TableCell>
                      {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}
                    </TableCell>
                    <TableCell>{s.capacity ?? t("unlimited")}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "secondary" : "outline"}>
                        {s.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ToggleScheduleButton id={s.id} isActive={s.is_active} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
