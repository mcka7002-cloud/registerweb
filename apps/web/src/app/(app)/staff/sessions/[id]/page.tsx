import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Hand, ScanLine } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SessionTeachersDialog } from "@/features/attendance/components/session-teachers-dialog";
import { StaffCheckinDialog } from "@/features/attendance/components/staff-checkin-dialog";
import { VoidAttendanceDialog } from "@/features/attendance/components/void-attendance-dialog";
import { getRoster, listBranchStaff, type RosterRow } from "@/features/attendance/queries";
import { hhmm, showStaffCheckin } from "@/features/attendance/shared";
import { BeltChip } from "@/features/belts/belt";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { cn, formatThaiDate } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_CLASS: Record<string, string> = {
  booked: "bg-accent text-accent-foreground",
  attended: "bg-success text-success-foreground",
  absent: "bg-warning text-warning-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const timeBkk = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(iso));

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const [t, tb, tc] = await Promise.all([
    getTranslations("attendance.roster"),
    getTranslations("attendance.bookingStatus"),
    getTranslations("attendance.list"),
  ]);
  const roster = UUID.test(id) ? await getRoster(id) : null;
  const back = (
    <Button asChild variant="outline" size="lg">
      <Link href="/staff/sessions">
        <ArrowLeft /> {t("back")}
      </Link>
    </Button>
  );

  if (!roster) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState title={t("notFound")} action={back} />
      </>
    );
  }

  const { session, rows } = roster;
  const isManager = me.role === "admin" || (me.role === "branch_manager" && me.branchIds.includes(session.branch_id));
  const canCheckin = !session.cancelled && showStaffCheckin(me, session);
  const isAdmin = me.role === "admin";
  const staff = isManager ? await listBranchStaff(session.branch_id) : [];
  const dateText = formatThaiDate(session.class_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title={
          <>
            {dateText} <span className="tabular-nums">{hhmm(session.starts_at)}–{hhmm(session.ends_at)}</span>
          </>
        }
        description={
          <>
            {session.branch} ·{" "}
            {session.teachers.length > 0 ? t("teachers", { names: session.teachers.map((x) => x.name).join(", ") }) : t("noTeachers")}
          </>
        }
        actions={
          <>
            {back}
            {isManager && !session.cancelled ? (
              <SessionTeachersDialog sessionId={session.id} staff={staff} current={session.teachers.map((x) => x.id)} />
            ) : null}
          </>
        }
      />

      {session.cancelled ? <p className="mb-4 rounded-xl bg-warning px-4 py-3 font-medium text-warning-foreground">{t("cancelled")}</p> : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums">
          {t("summary", { booked: roster.booked, checkedIn: roster.checkedIn })}
          {session.capacity ? <span className="text-muted-foreground"> · {tc("booked")} {roster.booked}/{session.capacity}</span> : null}
        </span>
      </div>

      {!canCheckin && !session.cancelled && me.role === "teacher" ? (
        <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("noCheckinRight")}</p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <RosterItem
              key={r.student.id}
              row={r}
              sessionId={session.id}
              canCheckin={canCheckin}
              isAdmin={isAdmin}
              labels={{
                status: (s) => tb(s),
                noBooking: t("noBooking"),
                notCheckedIn: t("notCheckedIn"),
                scan: t("scan"),
                manual: t("manual"),
                trial: t("trial"),
                reason: (reason) => t("reason", { reason }),
                recordedBy: (name, time) => t("recordedBy", { name, time }),
                voided: t("voided"),
                voidReason: (name, reason) => t("voidReason", { name, reason }),
                unknown: t("unknownPerson"),
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

interface Labels {
  status: (s: "booked" | "attended" | "absent" | "cancelled") => string;
  noBooking: string;
  notCheckedIn: string;
  scan: string;
  manual: string;
  trial: string;
  reason: (r: string) => string;
  recordedBy: (name: string, time: string) => string;
  voided: string;
  voidReason: (name: string, reason: string) => string;
  unknown: string;
}

function RosterItem({
  row,
  sessionId,
  canCheckin,
  isAdmin,
  labels,
}: {
  row: RosterRow;
  sessionId: string;
  canCheckin: boolean;
  isAdmin: boolean;
  labels: Labels;
}) {
  const { student, bookingStatus, attendances } = row;
  const active = attendances.some((a) => !a.voided_at);
  const display = student.nickname ? `${student.nickname} (${student.name})` : student.name;
  const showCheckin = canCheckin && !active && bookingStatus === "booked";

  return (
    <li>
      <Card className="py-4">
        <CardContent className="grid gap-3 px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
                {student.nickname ?? student.name}
                {student.nickname ? <span className="font-normal text-muted-foreground">{student.name}</span> : null}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{student.code}</span>
                {student.belt ? <BeltChip rankId={student.beltRankId} name={student.belt} /> : null}
                {bookingStatus ? (
                  <Badge className={STATUS_CLASS[bookingStatus]}>{labels.status(bookingStatus)}</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">{labels.noBooking}</Badge>
                )}
                {!active && attendances.length === 0 ? <span>{labels.notCheckedIn}</span> : null}
              </p>
            </div>
            {showCheckin ? (
              <div className="sm:shrink-0">
                <StaffCheckinDialog sessionId={sessionId} studentId={student.id} studentLabel={display} />
              </div>
            ) : null}
          </div>

          {attendances.length > 0 ? (
            <ul className="grid gap-2">
              {attendances.map((a) => {
                const voided = a.voided_at != null;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center",
                      voided ? "bg-muted text-muted-foreground" : "bg-success/15",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn("flex flex-wrap items-center gap-2 font-medium", voided && "line-through")}>
                        {a.method === "manual" ? <Hand className="size-4" aria-hidden /> : <ScanLine className="size-4" aria-hidden />}
                        {a.method === "manual" ? labels.manual : labels.scan}
                        {a.is_trial ? <Badge className="bg-accent text-accent-foreground">{labels.trial}</Badge> : null}
                        {a.reason ? <span className="font-normal">· {labels.reason(a.reason)}</span> : null}
                      </p>
                      <p className={cn("text-xs text-muted-foreground", voided && "line-through")}>
                        {labels.recordedBy(a.recordedBy ?? labels.unknown, timeBkk(a.recorded_at))}
                      </p>
                      {voided ? (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <Badge className="bg-muted text-destructive ring-1 ring-destructive/30">{labels.voided}</Badge>
                          <span className="text-destructive">{labels.voidReason(a.voidedBy ?? labels.unknown, a.void_reason ?? "")}</span>
                        </p>
                      ) : null}
                    </div>
                    {isAdmin && !voided ? (
                      <div className="sm:shrink-0">
                        <VoidAttendanceDialog sessionId={sessionId} attendanceId={a.id} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
