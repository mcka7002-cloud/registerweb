import { getTranslations } from "next-intl/server";
import { Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MembershipPriceForm } from "@/features/admin/components/membership-price-form";
import { TemplateDialog, ToggleTemplateButton } from "@/features/admin/components/template-dialog";
import { getMembershipPrices, listBranchOptions, listTemplates } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";
import { formatBaht } from "@/lib/utils";

export default async function PackagesPage() {
  await requireRole("admin");
  const [t, tc, templates, branches, membership] = await Promise.all([
    getTranslations("admin.packages"),
    getTranslations(),
    listTemplates(),
    listBranchOptions(),
    getMembershipPrices(),
  ]);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.code ?? "–") : t("allBranches");

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <TemplateDialog
            branches={branches}
            trigger={
              <Button>
                <Plus /> {t("add")}
              </Button>
            }
          />
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("membership")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MembershipPriceForm initial={membership} />
          </CardContent>
        </Card>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("templates")}</h2>
          {templates.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <Card className="py-2">
              <CardContent className="px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("branch")}</TableHead>
                      <TableHead className="text-right">{t("price")}</TableHead>
                      <TableHead>{t("sessions")}</TableHead>
                      <TableHead>{t("durationDays")}</TableHead>
                      <TableHead>{t("makeupAllowed")}</TableHead>
                      <TableHead>{t("isActive")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((p) => (
                      <TableRow key={p.id} className={p.is_active ? undefined : "text-muted-foreground"}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{branchName(p.branch_id)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBaht(p.price)}</TableCell>
                        <TableCell>{p.sessions == null ? t("unlimited") : t("times", { count: p.sessions })}</TableCell>
                        <TableCell>{t("days", { count: p.duration_days })}</TableCell>
                        <TableCell>{p.makeup_allowed}</TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? "secondary" : "outline"}>
                            {p.is_active ? t("active") : t("inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <TemplateDialog
                              template={p}
                              branches={branches}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  <Pencil /> {tc("actions.edit")}
                                </Button>
                              }
                            />
                            <ToggleTemplateButton id={p.id} isActive={p.is_active} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
