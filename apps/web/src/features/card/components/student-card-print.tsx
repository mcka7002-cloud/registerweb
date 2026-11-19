import Link from "next/link";
import { ArrowLeft, UserX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandLogo, Mascot } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BeltChip } from "@/features/belts/belt";
import { PrintButton } from "@/features/sales/components/print-button";
import { code128Svg, qrSvg } from "../barcode";
import type { CardStudent } from "../queries";

// Print exactly one credit-card sized page: no app bar, no page padding, colours kept.
const PRINT_CSS = `
@media print {
  @page { size: 85.6mm 54mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: none !important; }
  body > div { min-height: 0 !important; display: block !important; }
  body > div > header, nav { display: none !important; }
  main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .student-card-stage { padding: 0 !important; margin: 0 !important; background: none !important; display: block !important; }
  .student-card { zoom: 1 !important; box-shadow: none !important; border-radius: 0 !important; break-inside: avoid; page-break-after: avoid; }
  .student-card, .student-card * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}`;

function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="h-11">
      <Link href={href}>
        <ArrowLeft /> {label}
      </Link>
    </Button>
  );
}

/** Shown when the student is not visible to this user (RLS) or the id is not valid. */
export async function StudentCardNotFound({ backHref }: { backHref: string }) {
  const t = await getTranslations("card");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={UserX}
        title={t("notFound")}
        description={t("notFoundHint")}
        action={<BackButton href={backHref} label={t("back")} />}
      />
    </>
  );
}

/**
 * Student card, 85.6 × 54 mm: logo, photo (or the mascot), Thai name + nickname, English name, belt, branch,
 * code text, Code 128 and QR (both encode `students.code`). On screen it is centred and enlarged; print gives
 * one card per page at its exact size.
 */
export async function StudentCardPrint({ student: s, backHref }: { student: CardStudent; backHref: string }) {
  const [t, tApp] = await Promise.all([getTranslations("card"), getTranslations("app")]);
  const [barcode, qr] = [code128Svg(s.code), await qrSvg(s.code)];
  const fullName = `${s.firstName} ${s.lastName}`;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="print:hidden">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <>
              <BackButton href={backHref} label={t("back")} />
              <PrintButton label={t("print")} />
            </>
          }
        />
      </div>

      <div className="student-card-stage flex justify-center overflow-x-auto rounded-2xl bg-muted px-4 py-8 sm:py-12">
        <article
          aria-label={t("cardLabel", { name: fullName })}
          className="student-card relative flex h-[54mm] w-[85.6mm] shrink-0 flex-col overflow-hidden rounded-[3mm] bg-card text-card-foreground shadow-lg [zoom:1] sm:[zoom:1.6]"
        >
          {/* Header: logo, card title, branch */}
          <header className="flex h-[9.5mm] items-center justify-between gap-[2mm] border-b-[0.8mm] border-primary px-[3mm]">
            <BrandLogo alt={tApp("logoAlt")} className="h-[6.5mm]" />
            <div className="min-w-0 text-right leading-none">
              <p className="font-heading text-[2.6mm] text-primary">{t("cardTitle")}</p>
              {s.branchName ? (
                <p className="mt-[0.6mm] truncate text-[2mm] text-muted-foreground">
                  {t("branch", { name: s.branchName })}
                </p>
              ) : null}
            </div>
          </header>

          {/* Body: photo, names, belt, code, QR */}
          <div className="flex min-h-0 flex-1 gap-[2.5mm] px-[3mm] pt-[2mm]">
            <div className="flex h-[24mm] w-[19mm] shrink-0 items-center justify-center overflow-hidden rounded-[1.5mm] bg-muted">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image would not cache it
                <img src={s.photoUrl} alt={t("photoAlt", { name: fullName })} className="size-full object-cover" />
              ) : (
                <Mascot alt={t("photoAlt", { name: fullName })} className="h-[21mm]" />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-[0.8mm] leading-tight">
              <p className="truncate font-heading text-[3.4mm]">{fullName}</p>
              {s.nickname ? (
                <p className="truncate text-[2.4mm] text-muted-foreground">{t("nickname", { name: s.nickname })}</p>
              ) : null}
              <p className="truncate text-[2.4mm] uppercase tracking-wide">
                {s.firstNameEn} {s.lastNameEn}
              </p>
              {s.beltName ? (
                <BeltChip rankId={s.beltRankId} name={s.beltName} className="mt-[0.4mm] self-start text-[2.2mm]" />
              ) : null}
              <p className="mt-auto font-mono text-[4.6mm] font-semibold leading-none tracking-widest" aria-label={t("codeLabel")}>
                {s.code}
              </p>
            </div>

            {qr ? (
              <div
                className="size-[17mm] shrink-0 self-start"
                role="img"
                aria-label={t("qrAlt", { code: s.code })}
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : null}
          </div>

          {/* Code 128 across the bottom, with a white quiet zone on both sides */}
          {barcode ? (
            <div className="flex h-[10mm] items-center justify-center bg-card px-[6mm] pt-[1mm] pb-[1.5mm]">
              <div
                className="h-full w-[58mm]"
                role="img"
                aria-label={t("barcodeAlt", { code: s.code })}
                dangerouslySetInnerHTML={{ __html: barcode }}
              />
            </div>
          ) : null}
        </article>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground print:hidden">{t("printHint")}</p>
    </>
  );
}
