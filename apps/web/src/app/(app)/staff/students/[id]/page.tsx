import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookSessionsDialog } from "@/features/booking/components/book-sessions-dialog";
import { CancelBookingButton } from "@/features/booking/components/cancel-booking-button";
import { listUpcomingBookings, listUpcomingSessions, type SessionOption } from "@/features/booking/queries";
import { SellPackageDialog } from "@/features/sales/components/sell-package-dialog";
import { getSaleContext } from "@/features/sales/queries";
import { EditStudentDialog } from "@/features/students/components/edit-student-dialog";
import { getStudent, listStudentPackages } from "@/features/students/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatThaiDate, todayInBangkok } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const [t, tb, tc] = await Promise.all([getTranslations("students"), getTranslations("booking"), getTranslations()]);
  const student = UUID.test(id) ? await getStudent(id) : null;

  if (!student) {
    return (
      <>
        <PageHeader title={t("list.title")} />
        <EmptyState
          title={t("detail.notFound")}
          action={
            <Button asChild variant="outline">
              <Link href="/staff/students">{tc("actions.back")}</Link>
            </Button>
          }
        />
      </>
    );
  }

  const today = todayInBangkok();
  const [packages, bookings, saleContext] = await Promise.all([
    listStudentPackages(student.id),
    listUpcomingBookings(student.id, today),
    getSaleContext(student.branch_id),
  ]);

  const activePackages = packages.filter((p) => p.status === "active");
  const branchIds = [...new Set(activePackages.map((p) => p.branch_id))];
  const sessionsByBranch: Record<string, SessionOption[]> = Object.fromEntries(
    await Promise.all(branchIds.map(async (b) => [b, await listUpcomingSessions(b, today)] as const)),
  );
  const packageName = (pid: string) => packages.find((p) => p.id === pid)?.name ?? "";

  const expiry = student.membership_expires_on;
  const membershipDue = !expiry || expiry < today;
  const membershipText = !expiry
    ? t("detail.membershipNone")
    : expiry < today
      ? t("detail.membershipExpired", { date: formatThaiDate(expiry) })
      : t("detail.membershipUntil", { date: formatThaiDate(expiry) });

  return (
    <>
      <PageHeader
        title={
          <>
            {student.first_name} {student.last_name}
            {student.nickname ? <span className="font-normal text-muted-foreground"> ({student.nickname})</span> : null}
          </>
        }
        description={
          <>
            <span className="font-mono">{student.code}</span> · {student.first_name_en} {student.last_name_en}
          </>
        }
        actions={
          <>
            <EditStudentDialog studentId={student.id} student={student} />
            <SellPackageDialog
              studentId={student.id}
              context={saleContext}
              hasMembership={expiry != null}
              membershipDue={membershipDue}
            />
            <BookSessionsDialog
              studentId={student.id}
              packages={activePackages.map((p) => ({ id: p.id, branch_id: p.branch_id, name: p.name, remaining: p.remaining }))}
              sessionsByBranch={sessionsByBranch}
              bookedSessionIds={bookings.map((b) => b.class_session_id)}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="content-start">
          <CardHeader>
            <CardTitle>{t("detail.profile")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("detail.branch")}</dt>
              <dd>{student.branch?.name}</dd>
              <dt className="text-muted-foreground">{t("detail.belt")}</dt>
              <dd>{student.belt ?? "–"}</dd>
              <dt className="text-muted-foreground">{t("detail.membership")}</dt>
              <dd className={membershipDue ? "text-destructive" : undefined}>{membershipText}</dd>
              <dt className="text-muted-foreground">{t("fields.birth_date")}</dt>
              <dd>{formatThaiDate(student.birth_date)}</dd>
              <dt className="text-muted-foreground">{t("fields.height_cm")}</dt>
              <dd>{student.height_cm ?? "–"}</dd>
              <dt className="text-muted-foreground">{t("fields.weight_kg")}</dt>
              <dd>{student.weight_kg ?? "–"}</dd>
              <dt className="text-muted-foreground">{t("fields.uniform_size")}</dt>
              <dd>{student.uniform_size ?? "–"}</dd>
              <dt className="text-muted-foreground">{t("fields.medical_notes")}</dt>
              <dd>{student.medical_notes ?? "–"}</dd>
              <dt className="text-muted-foreground">{t("fields.emergency_name")}</dt>
              <dd>
                {student.emergency_name ?? "–"}
                {student.emergency_phone ? ` · ${student.emergency_phone}` : ""}
              </dd>
              <dt className="text-muted-foreground">{t("detail.examCounter")}</dt>
              <dd>{t("detail.times", { count: student.exam_counter })}</dd>
            </dl>
            <div className="mt-6 grid gap-2 text-sm">
              <p className="font-medium">{t("detail.guardians")}</p>
              {student.guardians.length === 0 ? (
                <p className="text-muted-foreground">{t("detail.noGuardians")}</p>
              ) : (
                student.guardians.map((g) => (
                  <p key={g.id}>
                    {g.full_name}
                    {g.nickname ? ` (${g.nickname})` : ""} · {g.relation} · {g.phones.join(", ")}
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.packages")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("detail.noPackages")}</p>
              ) : (
                packages.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.name}{" "}
                        <Badge variant={p.status === "active" ? "secondary" : "outline"}>{t(`detail.packageStatus.${p.status}`)}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("detail.paidOn", { date: formatThaiDate(p.paid_on) })} ·{" "}
                        {p.expires_on
                          ? t("detail.validUntil", { date: formatThaiDate(p.expires_on) })
                          : t("detail.notStarted", { date: formatThaiDate(p.must_start_by) })}
                      </p>
                      {p.sessions_total != null ? (
                        <p className="text-xs text-muted-foreground">
                          {t("detail.used", { used: p.sessions_used, total: p.sessions_total + p.bonus_sessions })}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-muted-foreground">{t("detail.sessionsLeft")}</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {p.remaining == null ? t("detail.unlimited") : p.remaining}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="pb-2">
            <CardHeader>
              <CardTitle>{tb("upcoming")}</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              {bookings.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">{tb("noBookings")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tb("date")}</TableHead>
                      <TableHead>{tb("time")}</TableHead>
                      <TableHead>{tb("package")}</TableHead>
                      <TableHead>{tb("status")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => {
                      const date = formatThaiDate(b.class_date, { weekday: "short", day: "numeric", month: "short" });
                      const time = `${b.starts_at.slice(0, 5)}–${b.ends_at.slice(0, 5)}`;
                      return (
                        <TableRow key={b.id}>
                          <TableCell>{date}</TableCell>
                          <TableCell className="tabular-nums">{time}</TableCell>
                          <TableCell>{packageName(b.student_package_id)}</TableCell>
                          <TableCell>
                            <Badge variant={b.status === "booked" ? "secondary" : "outline"}>{tb(`statuses.${b.status}`)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {b.status === "booked" ? (
                              <CancelBookingButton
                                studentId={student.id}
                                bookingId={b.id}
                                label={tb("cancelConfirm", { date, time })}
                              />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
