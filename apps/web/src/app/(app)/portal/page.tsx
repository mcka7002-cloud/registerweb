import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StudentCard } from "@/features/portal/components/student-card";
import { loadPortal } from "@/features/portal/queries";
import { requireRole } from "@/lib/auth";

export default async function PortalPage() {
  const me = await requireRole("customer");
  const t = await getTranslations("portal");
  const students = await loadPortal(me.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      {students.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href="/register">{t("empty.action")}</Link>
            </Button>
          }
        />
      ) : (
        students.map((s) => <StudentCard key={s.id} student={s} />)
      )}
    </div>
  );
}
