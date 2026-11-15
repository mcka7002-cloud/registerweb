import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Clock, Phone, UserX } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PurchaseForm } from "@/features/payments/components/purchase-form";
import { promptPayQrDataUrl } from "@/features/payments/qr";
import { getPurchaseOptions } from "@/features/payments/queries";
import { amountKey, previewTotal } from "@/features/payments/shared";
import { requireRole } from "@/lib/auth";
import { formatBaht, formatThaiDate } from "@/lib/utils";

export default async function BuyPackagePage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireRole("customer");
  const { studentId } = await params;
  const t = await getTranslations("payments.buy");

  const back = (
    <Button asChild variant="outline">
      <Link href="/portal">
        <ArrowLeft /> {t("back")}
      </Link>
    </Button>
  );

  const options = z.string().uuid().safeParse(studentId).success ? await getPurchaseOptions(studentId) : null;
  if (!options) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={UserX} title={t("notFound")} description={t("notFoundHint")} action={back} />
      </>
    );
  }

  const { student, payment, pending_order: pendingOrder } = options;
  const hasPayment = Boolean(payment.promptpay_id || payment.bank_account);

  let body: React.ReactNode;
  if (pendingOrder) {
    const sent = new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    }).format(new Date(pendingOrder.created_at));
    body = (
      <EmptyState
        icon={Clock}
        title={t("pendingTitle")}
        description={t("pendingHint", { amount: formatBaht(pendingOrder.total), date: sent })}
        action={back}
      />
    );
  } else if (!hasPayment) {
    body = <EmptyState icon={Phone} title={t("noPayment")} description={t("noPaymentHint")} action={back} />;
  } else if (options.templates.length === 0) {
    body = <EmptyState title={t("noTemplates")} action={back} />;
  } else {
    // One QR per possible total (each template, with/without membership), rendered here on the server.
    const qrByAmount: Record<string, string | null> = {};
    if (payment.promptpay_id) {
      const totals = new Set<number>();
      for (const tpl of options.templates) {
        for (const withMembership of options.membership_required ? [true] : [false, true]) {
          totals.add(previewTotal(tpl.price, options.membership_price, withMembership, options.vat).total);
        }
      }
      await Promise.all(
        [...totals].map(async (total) => {
          qrByAmount[amountKey(total)] = await promptPayQrDataUrl(payment.promptpay_id!, total);
        }),
      );
    }
    body = <PurchaseForm options={options} qrByAmount={qrByAmount} />;
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("student")}</p>
            <p className="font-semibold">
              {student.name}
              {student.nickname ? <span className="font-normal text-muted-foreground"> ({student.nickname})</span> : null}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{student.code}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {student.membership_expires_on
              ? t("membershipUntil", { date: formatThaiDate(student.membership_expires_on) })
              : t("noMembership")}
          </p>
        </CardContent>
      </Card>
      {body}
    </div>
  );
}
