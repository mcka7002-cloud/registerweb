import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UserCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentForm } from "@/features/trial/components/assessment-form";
import { RejectTrialDialog } from "@/features/trial/components/reject-trial-dialog";
import { TrialSummary } from "@/features/trial/components/trial-summary";
import { getTrialInfo, listTemplateOptions } from "@/features/trial/queries";
import { requireRole } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TrialAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "branch_manager", "teacher");
  const { id } = await params;
  const t = await getTranslations("trial");
  const info = UUID.test(id) ? await getTrialInfo(id) : null;

  if (!info || info.status !== "trial_booked" || !info.session) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          title={info ? t("notBooked") : t("notFound")}
          action={
            <Button asChild variant="outline">
              <Link href={info ? `/staff/registrations/${info.id}` : "/staff/trials"}>
                {info ? t("openRegistrations") : t("back")}
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  const templates = await listTemplateOptions(info.branchId);

  return (
    <>
      <PageHeader
        title={`${info.studentName || "–"}${info.nickname ? ` (${info.nickname})` : ""}`}
        description={info.parentName ? t("parent", { name: info.parentName }) : undefined}
        actions={
          <Button asChild variant="outline">
            <Link href="/staff/trials">{t("back")}</Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("card.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TrialSummary info={info} />
            </CardContent>
          </Card>
          {info.notes ? (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle>{t("next.title")}</CardTitle>
                <CardDescription>{t("next.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="min-h-12 px-8 text-base">
                  <Link href={`/staff/registrations/${info.id}#approve`}>
                    <UserCheck /> {t("next.approve")}
                  </Link>
                </Button>
                <RejectTrialDialog registrationId={info.id} />
              </CardContent>
            </Card>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{info.notes ? t("editAssessment") : t("form.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AssessmentForm
              registrationId={info.id}
              templates={templates}
              initial={info.notes}
              initialAttended={info.attendedAt != null}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
