import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClipboardList, ScanLine, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTodaySessions } from "@/features/booking/queries";
import { countOpenRegistrations } from "@/features/students/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

export default async function StaffHomePage() {
  const me = await requireRole(...STAFF_ROLES);
  const today = todayInBangkok();
  const [t, sessions, pending] = await Promise.all([
    getTranslations("students.staffHome"),
    listTodaySessions(me.role === "admin" ? "all" : me.branchIds, today),
    countOpenRegistrations(),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/staff/students">
                <Search /> {t("students")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kiosk">
                <ScanLine /> {t("kiosk")}
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-3">
          <h2 className="text-lg font-semibold">{t("today", { date: formatThaiDate(today, { weekday: "long", day: "numeric", month: "long" }) })}</h2>
          {sessions.length === 0 ? (
            <EmptyState title={t("noSessions")} />
          ) : (
            <Card className="py-2">
              <CardContent className="px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("time")}</TableHead>
                      <TableHead>{t("branch")}</TableHead>
                      <TableHead className="text-right">{t("booked")}</TableHead>
                      <TableHead className="text-right">{t("attended")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium tabular-nums">
                          {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}
                        </TableCell>
                        <TableCell>{s.branch}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.booked}
                          {s.capacity ? <span className="text-muted-foreground">/{s.capacity}</span> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.attended}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
        <Card className="content-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-muted-foreground" aria-hidden />
              {t("pending")}
            </CardTitle>
            <CardDescription className="text-3xl font-semibold text-foreground">{t("pendingCount", { count: pending })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/staff/registrations">{t("openRegistrations")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
