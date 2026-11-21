import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBranchOptions } from "@/features/admin/queries";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, auditHref, parseAuditFilters } from "@/features/control/audit";
import { AuditDetails } from "@/features/control/components/audit-details";
import { formatThaiDateTime } from "@/features/control/format";
import { listAuditLogs } from "@/features/control/queries";
import { requireRole } from "@/lib/auth";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const filters = parseAuditFilters(await searchParams);
  const badRange = filters.from > filters.to;
  const [t, branches, result] = await Promise.all([
    getTranslations("control.audit"),
    listBranchOptions(),
    badRange ? Promise.resolve({ rows: [], hasNext: false }) : listAuditLogs(filters),
  ]);
  const actionLabel = (a: string) => ((AUDIT_ACTIONS as readonly string[]).includes(a) ? t(`actions.${a as (typeof AUDIT_ACTIONS)[number]}`) : a);
  const entityLabel = (e: string) =>
    (AUDIT_ENTITIES as readonly string[]).includes(e) ? t(`entities.${e as (typeof AUDIT_ENTITIES)[number]}`) : e;

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <form method="get" className="mb-4 grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from} className="bg-background" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} className="bg-background" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="branch">{t("branch")}</Label>
          <select id="branch" name="branch" defaultValue={filters.branch ?? ""} className={`${SELECT_CLASS} bg-background`}>
            <option value="">{t("allBranches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="action">{t("action")}</Label>
          <select id="action" name="action" defaultValue={filters.action ?? ""} className={`${SELECT_CLASS} bg-background`}>
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">{t("filter")}</Button>
          <Button asChild variant="ghost">
            <Link href="/admin/audit">{t("reset")}</Link>
          </Button>
        </div>
      </form>

      {badRange ? (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("badRange")}
        </p>
      ) : null}

      {result.rows.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <Card className="py-2">
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("branch")}</TableHead>
                  <TableHead>{t("who")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead>{t("details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="whitespace-nowrap tabular-nums">{formatThaiDateTime(r.created_at)}</TableCell>
                    <TableCell>{r.branch ?? t("noBranch")}</TableCell>
                    <TableCell>{r.actor ?? (r.actor_id ? t("unknownUser") : t("system"))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{actionLabel(r.action)}</Badge>
                    </TableCell>
                    <TableCell>{entityLabel(r.entity)}</TableCell>
                    <TableCell className="min-w-56 whitespace-normal">
                      <AuditDetails data={r.data} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filters.page > 1 || result.hasNext ? (
        <nav className="mt-4 flex items-center justify-between gap-2">
          {filters.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={auditHref(filters, filters.page - 1)}>
                <ChevronLeft /> {t("prev")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{t("page", { page: filters.page })}</span>
          {result.hasNext ? (
            <Button asChild variant="outline">
              <Link href={auditHref(filters, filters.page + 1)}>
                {t("next")} <ChevronRight />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
