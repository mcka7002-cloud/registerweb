import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BranchPicker } from "@/features/admin/components/branch-picker";
import { listBranchOptions } from "@/features/admin/queries";
import { ImportForm } from "@/features/import/components/import-form";
import { requireRole } from "@/lib/auth";

const TIPS = ["required", "date", "belt", "code", "guardian"] as const;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const me = await requireRole("admin", "branch_manager");
  const t = await getTranslations("import");
  // branches are readable by everyone; a manager may import only into own branches
  const all = await listBranchOptions();
  const branches = me.role === "admin" ? all : all.filter((b) => me.branchIds.includes(b.id));
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

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<BranchPicker branches={branches} value={branchId} label={t("branch")} />}
      />
      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-3">
            <h2 className="font-semibold">{t("step1")}</h2>
            <div>
              <Button asChild variant="secondary">
                <a href="/templates/students-import.csv" download="แบบฟอร์มนำเข้านักเรียน.csv">
                  <Download aria-hidden />
                  {t("download")}
                </a>
              </Button>
            </div>
            <p className="rounded-xl bg-muted px-4 py-3 text-sm">{t("howTo")}</p>
            <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
              {TIPS.map((k) => (
                <li key={k}>{t(`tips.${k}`)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        {/* key: switching branch starts over */}
        <ImportForm key={branchId} branchId={branchId} />
      </div>
    </>
  );
}
