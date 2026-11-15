import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReviewActions } from "@/features/payments/components/review-actions";
import { SlipImage } from "@/features/payments/components/slip-image";
import { getTodayTakings, listPendingOrders, listRecentRejected } from "@/features/payments/queries";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { formatBaht } from "@/lib/utils";

const dateTime = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});
const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default async function StaffPaymentsPage() {
  const me = await requireRole(...STAFF_ROLES);
  const [t, pending, takings, rejected] = await Promise.all([
    getTranslations("payments.staff"),
    listPendingOrders(),
    getTodayTakings(),
    listRecentRejected(),
  ]);
  const seesBranch = me.role !== "teacher";

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="grid content-start gap-3" aria-labelledby="pending-title">
          <h2 id="pending-title" className="flex items-center gap-2 text-lg font-semibold">
            {t("pending")}
            {pending.length > 0 ? <Badge>{t("pendingCount", { count: pending.length })}</Badge> : null}
          </h2>
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t("noPending")} />
          ) : (
            pending.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex flex-col gap-4 sm:flex-row">
                  <SlipImage url={o.slipUrl} />
                  <div className="grid min-w-0 flex-1 content-start gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xl font-semibold tabular-nums">
                        {formatBaht(o.total)} <span className="text-sm font-normal">฿</span>
                      </p>
                      {o.method ? <Badge variant="secondary">{t(`methods.${o.method}`)}</Badge> : null}
                    </div>
                    <ul className="grid gap-1 text-sm">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between gap-2">
                          <span className="min-w-0">
                            {i.description}
                            {i.student ? (
                              <span className="block text-xs text-muted-foreground">
                                {i.student.code} {i.student.name}
                                {i.student.nickname ? ` (${i.student.nickname})` : ""}
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums">{formatBaht(i.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {o.parent ? `${t("parent")}: ${o.parent} · ` : ""}
                      {o.branch ? `${o.branch} · ` : ""}
                      {t("submittedAt", { date: dateTime.format(new Date(o.created_at)) })}
                    </p>
                    <ReviewActions orderId={o.id} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("today")}</CardTitle>
              <CardDescription>{seesBranch ? t("todayBranch") : t("todayMine")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
                {takings.byMethod.map((m) => (
                  <div key={m.method} className="contents">
                    <dt>{t(`methods.${m.method}`)}</dt>
                    <dd className="text-right">{formatBaht(m.total)}</dd>
                  </div>
                ))}
                <dt className="border-t pt-1 font-semibold">{t("grandTotal")}</dt>
                <dd className="border-t pt-1 text-right text-lg font-semibold">{formatBaht(takings.grandTotal)}</dd>
              </dl>
              {takings.payments.length === 0 ? (
                <EmptyState icon={Wallet} title={t("noToday")} className="py-6" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("time")}</TableHead>
                      <TableHead>{t("docNo")}</TableHead>
                      <TableHead className="text-right">{t("amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {takings.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="tabular-nums">{time.format(new Date(p.paid_at))}</TableCell>
                        <TableCell>
                          {p.documentId ? (
                            <Link href={`/receipts/${p.documentId}`} className="font-medium underline-offset-4 hover:underline">
                              {p.docNo}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {p.students.length > 0 ? (
                            <span className="block text-xs text-muted-foreground">{p.students.join(", ")}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBaht(p.amount)}
                          <span className="block text-xs text-muted-foreground">{t(`methods.${p.method}`)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>{t("grandTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBaht(takings.grandTotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-2" aria-labelledby="rejected-title">
            <h2 id="rejected-title" className="text-sm font-semibold text-muted-foreground">
              {t("recentRejected")}
            </h2>
            {rejected.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noRejected")}</p>
            ) : (
              <ul className="grid gap-2 text-xs">
                {rejected.map((r) => (
                  <li key={r.id} className="rounded-md border p-2">
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{r.students.join(", ") || "—"}</span>
                      <span className="tabular-nums">{formatBaht(r.total)}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {r.reviewed_at ? `${dateTime.format(new Date(r.reviewed_at))} · ` : ""}
                      {r.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
