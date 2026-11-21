import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApproveForm } from "@/features/students/components/approve-form";
import { RejectForm } from "@/features/students/components/reject-form";
import { StudentPhoto } from "@/features/students/components/student-photo";
import { formatThaiDateTime } from "@/features/students/format";
import { getRegistration, type Guardian } from "@/features/students/queries";
import { BookTrialDialog } from "@/features/trial/components/book-trial-dialog";
import { TrialSummary } from "@/features/trial/components/trial-summary";
import { getTrialInfo, listUpcomingSessions } from "@/features/trial/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatThaiDate } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RegistrationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const [t, tc, tt] = await Promise.all([getTranslations("students"), getTranslations(), getTranslations("trial")]);
  const [reg, trial] = UUID.test(id) ? await Promise.all([getRegistration(id), getTrialInfo(id)]) : [null, null];

  if (!reg) {
    return (
      <>
        <PageHeader title={t("review.title")} />
        <EmptyState
          title={t("review.notFound")}
          action={
            <Button asChild variant="outline">
              <Link href="/staff/registrations">{tc("actions.back")}</Link>
            </Button>
          }
        />
      </>
    );
  }

  const open = reg.status === "pending" || reg.status === "trial_booked";
  const sessions = open && trial ? await listUpcomingSessions(trial.branchId) : [];
  const recommendedTemplateId = trial?.notes?.recommended_template_id ?? null;
  const { guardians, photo_path, ...fields } = reg.payload;
  const fullName = [reg.payload.first_name, reg.payload.last_name].filter(Boolean).join(" ");
  const label = (k: string) => (t.has(`fields.${k}`) ? t(`fields.${k}`) : k);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const show = (k: string, v: unknown) => {
    if (v == null || v === "") return "–";
    if (k === "gender" && typeof v === "string" && t.has(`genders.${v}`)) return t(`genders.${v}`);
    if (typeof v === "string" && ISO_DATE.test(v)) return formatThaiDate(v);
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };

  return (
    <>
      <PageHeader
        title={t("review.title")}
        description={`${reg.branch?.name ?? ""} · ${formatThaiDateTime(reg.created_at)}`}
        actions={
          <Badge
            variant="secondary"
            className={
              reg.status === "pending"
                ? "bg-warning text-warning-foreground"
                : reg.status === "approved"
                  ? "bg-success text-success-foreground"
                  : reg.status === "trial_booked"
                    ? "bg-accent text-accent-foreground"
                    : undefined
            }
          >
            {t(`registrations.statuses.${reg.status}`)}
          </Badge>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("review.parentAccount")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {reg.parent ? (
                <>
                  <p className="font-medium">{reg.parent.full_name}</p>
                  <p className="text-muted-foreground">{reg.parent.email}</p>
                </>
              ) : (
                <p className="text-muted-foreground">{t("review.noAccount")}</p>
              )}
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">{t("review.pdpa")}</dt>
                <dd>{reg.pdpa_consent ? t("review.yes") : t("review.no")}</dd>
                <dt className="text-muted-foreground">{t("review.publish")}</dt>
                <dd>{reg.publish_consent ? t("review.yes") : t("review.no")}</dd>
              </dl>
            </CardContent>
          </Card>
          {trial ? (
            <Card>
              <CardHeader>
                <CardTitle>{tt("card.title")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <TrialSummary info={trial} />
                {open ? (
                  <div className="flex flex-wrap gap-3">
                    <BookTrialDialog
                      registrationId={reg.id}
                      branchName={trial.branchName}
                      sessions={sessions}
                      currentSessionId={reg.status === "trial_booked" ? (trial.session?.id ?? null) : null}
                    />
                    {reg.status === "trial_booked" ? (
                      <Button asChild size="lg">
                        <Link href={`/staff/trials/${reg.id}`}>
                          {trial.notes ? tt("editAssessment") : tt("assess")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("review.payload")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentPhoto
                path={typeof photo_path === "string" ? photo_path : null}
                alt={fullName}
                className="mb-4"
              />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {Object.entries(fields).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{label(k)}</dt>
                    <dd className="break-words">{show(k, v)}</dd>
                  </div>
                ))}
              </dl>
              {(guardians as Guardian[] | undefined)?.length ? (
                <div className="mt-4 grid gap-2 text-sm">
                  <p className="font-medium">{t("review.guardians")}</p>
                  {(guardians as Guardian[]).map((g, i) => (
                    <p key={i}>
                      {g.full_name}
                      {g.nickname ? ` (${g.nickname})` : ""} · {g.relation} · {(g.phones ?? []).join(", ")}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {open ? (
          <div className="grid content-start gap-6">
            <Card id="approve" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>{t("review.approveTitle")}</CardTitle>
                <CardDescription>{t("review.approveHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ApproveForm registrationId={reg.id} payload={reg.payload} recommendedTemplateId={recommendedTemplateId} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("review.rejectTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <RejectForm registrationId={reg.id} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="content-start">
            <CardHeader>
              <CardTitle>{t("review.closed")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {reg.reject_reason ? (
                <p>
                  {t("review.rejectReason")}: {reg.reject_reason}
                </p>
              ) : null}
              {reg.student_id ? (
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/staff/students/${reg.student_id}`}>{t("review.openStudent")}</Link>
                  </Button>
                  {recommendedTemplateId ? (
                    <Button asChild variant="outline">
                      <Link href={`/staff/students/${reg.student_id}?template=${recommendedTemplateId}`}>
                        {tt("card.sellRecommended")}
                        {trial?.recommendedName ? ` · ${trial.recommendedName}` : ""}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
