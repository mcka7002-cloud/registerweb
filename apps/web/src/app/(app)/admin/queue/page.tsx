import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoidReviewActions } from "@/features/control/components/void-review-actions";
import { formatThaiDateTime } from "@/features/control/format";
import { listVoidRequests } from "@/features/control/queries";
import { requireRole } from "@/lib/auth";
import { formatBaht } from "@/lib/utils";

export default async function QueuePage() {
  await requireRole("admin");
  const [t, tAudit, rows] = await Promise.all([
    getTranslations("control.queue"),
    getTranslations("control.audit"),
    listVoidRequests(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {rows.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("docNo")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead>{t("branch")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("requestedBy")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell>
                      <Link href={`/receipts/${r.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
                        {r.doc_no}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{tAudit("values.baht", { amount: formatBaht(r.total) })}</TableCell>
                    <TableCell>{r.branch ?? tAudit("noBranch")}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>
                      <div>{r.requested_by ?? tAudit("unknownUser")}</div>
                      <div className="text-xs text-muted-foreground">{formatThaiDateTime(r.requested_at)}</div>
                    </TableCell>
                    <TableCell className="min-w-48 whitespace-normal">{r.reason}</TableCell>
                    <TableCell>
                      <VoidReviewActions documentId={r.id} docNo={r.doc_no} />
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
