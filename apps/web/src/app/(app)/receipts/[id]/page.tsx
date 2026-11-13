import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/features/sales/components/print-button";
import { getReceipt } from "@/features/sales/queries";
import { requireRole } from "@/lib/auth";
import { formatBaht } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Print only the receipt: hide the app bar and page chrome.
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  body > div > header, nav { display: none !important; }
  main { padding: 0 !important; max-width: none !important; }
  .receipt-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; }
}`;

function formatIssuedAt(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole();
  const { id } = await params;
  const [t, ts] = await Promise.all([getTranslations("sales.receipt"), getTranslations("sales")]);
  const doc = UUID.test(id) ? await getReceipt(id) : null;

  if (!doc) return <EmptyState title={t("notFound")} description={t("notFoundHint")} />;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton label={t("print")} />
      </div>
      <article className="receipt-sheet mx-auto max-w-3xl rounded-lg border bg-white p-6 text-sm text-black shadow-sm sm:p-10">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-semibold">{doc.branch?.name}</p>
            {doc.branch?.address ? <p className="text-neutral-600">{doc.branch.address}</p> : null}
            {doc.branch?.tax_id ? (
              <p className="text-neutral-600">
                {t("taxId")} {doc.branch.tax_id}
              </p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <h1 className="text-xl font-semibold">
              {doc.doc_type === "tax_invoice" ? t("taxInvoice") : t("title")}
              <span className="ml-2 text-sm font-normal text-neutral-500">{t("titleEn")}</span>
            </h1>
            {doc.status === "void" ? <Badge variant="destructive">{t("void")}</Badge> : null}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 sm:justify-end">
              <dt className="text-neutral-600">{t("docNo")}</dt>
              <dd className="font-mono">{doc.doc_no}</dd>
              <dt className="text-neutral-600">{t("date")}</dt>
              <dd>{formatIssuedAt(doc.issued_at)}</dd>
            </dl>
          </div>
        </header>

        <section className="border-b py-4">
          <p className="text-neutral-600">{t("customer")}</p>
          <p className="font-medium">{doc.customer_name}</p>
          {doc.customer_address ? <p>{doc.customer_address}</p> : null}
          {doc.customer_tax_id ? (
            <p>
              {t("taxId")} {doc.customer_tax_id}
            </p>
          ) : null}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse">
            <thead>
              <tr className="border-b text-left text-neutral-600">
                <th className="py-2 pr-2 font-medium">{t("description")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("qty")}</th>
                <th className="px-2 py-2 text-right font-medium">{t("unitPrice")}</th>
                <th className="py-2 pl-2 text-right font-medium">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((i) => (
                <tr key={i.id} className="border-b align-top">
                  <td className="py-2 pr-2">
                    {i.description}
                    {i.student ? (
                      <div className="text-xs text-neutral-500">
                        {t("student")}: {i.student.first_name} {i.student.last_name} ({i.student.code})
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{i.qty}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatBaht(i.unit_price)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{formatBaht(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
          <dt className="text-neutral-600">{t("net")}</dt>
          <dd className="text-right">{formatBaht(doc.subtotal)}</dd>
          <dt className="text-neutral-600">
            {t("vat", { rate: doc.vat_rate })}
            {doc.vat_rate > 0 && doc.vat_inclusive ? <span className="block text-xs">{t("vatInclusive")}</span> : null}
          </dt>
          <dd className="text-right">{formatBaht(doc.vat_amount)}</dd>
          <dt className="border-t pt-1 font-semibold">{t("total")}</dt>
          <dd className="border-t pt-1 text-right text-base font-semibold">
            {formatBaht(doc.total)} {t("baht")}
          </dd>
        </dl>

        {doc.paymentMethod ? (
          <p className="mt-6 text-neutral-600">
            {t("paidBy")}: {ts(`methods.${doc.paymentMethod}`)}
          </p>
        ) : null}
      </article>
    </>
  );
}
