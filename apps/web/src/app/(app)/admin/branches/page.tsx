import { getTranslations } from "next-intl/server";
import { Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BranchDialog } from "@/features/admin/components/branch-dialog";
import { listBranches } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";

export default async function BranchesPage() {
  await requireRole("admin");
  const [t, tc, branches] = await Promise.all([getTranslations("admin.branches"), getTranslations(), listBranches()]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <BranchDialog
            trigger={
              <Button>
                <Plus /> {t("add")}
              </Button>
            }
          />
        }
      />
      {branches.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("taxId")}</TableHead>
                  <TableHead>{t("vat")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{b.name}</div>
                      {b.address ? <div className="text-xs text-muted-foreground">{b.address}</div> : null}
                    </TableCell>
                    <TableCell>{b.tax_id ?? "–"}</TableCell>
                    <TableCell>
                      {b.vat_enabled ? (
                        <Badge variant="secondary">
                          {b.vat_inclusive
                            ? t("vatInclusiveShort", { rate: b.vat_rate })
                            : t("vatExclusiveShort", { rate: b.vat_rate })}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("vatOff")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <BranchDialog
                        branch={b}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Pencil /> {tc("actions.edit")}
                          </Button>
                        }
                      />
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
