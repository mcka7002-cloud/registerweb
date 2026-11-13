import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatThaiDateTime } from "@/features/students/format";
import { listOpenRegistrations } from "@/features/students/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";

export default async function RegistrationsPage() {
  await requireRole(...STAFF_ROLES);
  const [t, rows] = await Promise.all([getTranslations("students.registrations"), listOpenRegistrations()]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("student")}</TableHead>
                  <TableHead>{t("parent")}</TableHead>
                  <TableHead>{t("branch")}</TableHead>
                  <TableHead>{t("submitted")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.studentName || "–"}</div>
                      {r.nickname ? <div className="text-xs text-muted-foreground">{r.nickname}</div> : null}
                    </TableCell>
                    <TableCell>{r.parentName ?? "–"}</TableCell>
                    <TableCell>{r.branch}</TableCell>
                    <TableCell>{formatThaiDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "trial_booked" ? "default" : "secondary"}>
                        {t(`statuses.${r.status}`)}
                      </Badge>
                      {r.trial_at ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t("trialAt")} {formatThaiDateTime(r.trial_at)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link href={`/staff/registrations/${r.id}`}>{t("open")}</Link>
                      </Button>
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
