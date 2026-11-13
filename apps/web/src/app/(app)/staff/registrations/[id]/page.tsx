import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApproveForm } from "@/features/students/components/approve-form";
import { RejectForm } from "@/features/students/components/reject-form";
import { formatThaiDateTime } from "@/features/students/format";
import { getRegistration, type Guardian } from "@/features/students/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RegistrationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const [t, tc] = await Promise.all([getTranslations("students"), getTranslations()]);
  const reg = UUID.test(id) ? await getRegistration(id) : null;

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
  const { guardians, ...fields } = reg.payload;
  const label = (k: string) => (t.has(`fields.${k}`) ? t(`fields.${k}`) : k);
  const show = (v: unknown) => (v == null || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <>
      <PageHeader
        title={t("review.title")}
        description={`${reg.branch?.name ?? ""} · ${formatThaiDateTime(reg.created_at)}`}
        actions={<Badge variant="secondary">{t(`registrations.statuses.${reg.status}`)}</Badge>}
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
                {reg.trial_at ? (
                  <>
                    <dt className="text-muted-foreground">{t("registrations.trialAt")}</dt>
                    <dd>{formatThaiDateTime(reg.trial_at)}</dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("review.payload")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {Object.entries(fields).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{label(k)}</dt>
                    <dd className="break-words">{show(v)}</dd>
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
            <Card>
              <CardHeader>
                <CardTitle>{t("review.approveTitle")}</CardTitle>
                <CardDescription>{t("review.approveHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ApproveForm registrationId={reg.id} payload={reg.payload} />
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
                <Button asChild className="justify-self-start">
                  <Link href={`/staff/students/${reg.student_id}`}>{t("review.openStudent")}</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
