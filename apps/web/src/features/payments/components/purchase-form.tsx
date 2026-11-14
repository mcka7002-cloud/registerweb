"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBaht } from "@/lib/utils";
import { submitPurchase } from "../actions";
import type { PurchaseOptions } from "../queries";
import { amountKey, previewTotal, SLIP_MAX_BYTES, SLIP_TYPES } from "../shared";
import { useErrorText } from "./use-error-text";

type Method = "promptpay" | "transfer";

/** Server actions accept ~1 MB bodies by default; larger photos are re-encoded as JPEG in the browser first. */
const SHRINK_ABOVE_BYTES = 900 * 1024;
const SHRINK_MAX_SIDE = 1800;

async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC the browser cannot decode: send as is
  }
}

export function PurchaseForm({ options, qrByAmount }: { options: PurchaseOptions; qrByAmount: Record<string, string | null> }) {
  const t = useTranslations("payments.buy");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { payment, vat, templates } = options;
  const methods: Method[] = [
    ...(payment.promptpay_id ? (["promptpay"] as const) : []),
    ...(payment.bank_account ? (["transfer"] as const) : []),
  ];

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [optionalMembership, setOptionalMembership] = useState(false);
  const [method, setMethod] = useState<Method>(methods[0] ?? "transfer");
  const [slip, setSlip] = useState<File | null>(null);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slip) return setPreviewUrl(null);
    const url = URL.createObjectURL(slip);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slip]);

  const template = templates.find((x) => x.id === templateId);
  const withMembership = options.membership_required || optionalMembership;
  const preview = previewTotal(template?.price ?? 0, options.membership_price, withMembership, vat);
  const qr = qrByAmount[amountKey(preview.total)] ?? null;
  const membershipLabel = options.membership_kind === "new" ? t("membershipNew") : t("membershipRenewal");

  function onPick(file: File | undefined) {
    setSlipError(null);
    if (!file) return setSlip(null);
    if (!(file.type in SLIP_TYPES)) {
      setSlip(null);
      return setSlipError(t("slipNotImage"));
    }
    if (file.size > SLIP_MAX_BYTES) {
      setSlip(null);
      return setSlipError(t("slipTooBig"));
    }
    setSlip(file);
  }

  function submit() {
    if (!template || !slip) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("student_id", options.student.id);
      form.set("template_id", template.id);
      form.set("with_membership", withMembership ? "1" : "0");
      form.set("method", method);
      form.set("slip", await shrinkImage(slip));
      const res = await submitPurchase(form);
      if (!res.ok) {
        toast.error(errorText(res.code));
        return;
      }
      toast.success(t("sent"));
      router.push("/portal");
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("package")}</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset className="grid gap-2">
            <legend className="sr-only">{t("package")}</legend>
            {templates.map((x) => (
              <label
                key={x.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  x.id === templateId ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={x.id}
                  checked={x.id === templateId}
                  onChange={() => setTemplateId(x.id)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{x.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {x.sessions == null ? t("unlimited") : t("sessions", { count: x.sessions })} ·{" "}
                    {t("days", { count: x.duration_days })}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatBaht(x.price)}</span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("membership")}</CardTitle>
        </CardHeader>
        <CardContent>
          {options.membership_required ? (
            <div className="flex items-start justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">{membershipLabel}</span>
                <span className="block text-xs text-muted-foreground">{t("membershipRequired")}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatBaht(options.membership_price)}</span>
            </div>
          ) : (
            <label htmlFor="buy-membership" className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                id="buy-membership"
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={optionalMembership}
                onChange={(e) => setOptionalMembership(e.target.checked)}
              />
              <span className="flex-1">
                <span className="block font-medium">{t("membershipRenewal")}</span>
                <span className="block text-xs text-muted-foreground">{t("membershipOptional")}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatBaht(options.membership_price)}</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
            <dt>{t("net")}</dt>
            <dd className="text-right">{formatBaht(preview.net)}</dd>
            <dt>{vat.enabled ? t("vat", { rate: vat.rate }) : t("noVat")}</dt>
            <dd className="text-right">{formatBaht(preview.vat)}</dd>
            <dt className="font-semibold">{t("total")}</dt>
            <dd className="text-right text-lg font-semibold">
              {formatBaht(preview.total)} {t("baht")}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{t("previewNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pay")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {methods.length > 1 ? (
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-sm font-medium">{t("method")}</legend>
              {methods.map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm",
                    m === method ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m}
                    checked={m === method}
                    onChange={() => setMethod(m)}
                    className="size-4 accent-primary"
                  />
                  {t(`methods.${m}`)}
                </label>
              ))}
            </fieldset>
          ) : null}

          {method === "promptpay" && payment.promptpay_id ? (
            <div className="grid justify-items-center gap-2 text-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG data URL
                <img
                  src={qr}
                  alt={t("qrAlt", { amount: formatBaht(preview.total) })}
                  className="size-56 rounded-md border bg-white p-2"
                />
              ) : null}
              <p className="text-lg font-semibold tabular-nums">
                {formatBaht(preview.total)} {t("baht")}
              </p>
              {qr ? <p className="text-xs text-muted-foreground">{t("qrHint")}</p> : null}
              <p className="text-sm">
                {t("promptpayId")}: <span className="font-medium tabular-nums">{payment.promptpay_id}</span>
              </p>
            </div>
          ) : null}

          {method === "transfer" && payment.bank_account ? (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{t("bankAccount")}</p>
              <p className="whitespace-pre-line">{payment.bank_account}</p>
              <p className="mt-2 font-semibold tabular-nums">
                {t("total")} {formatBaht(preview.total)} {t("baht")}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <p className="text-sm font-medium">{t("slip")}</p>
            <label
              htmlFor="buy-slip"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm hover:bg-muted/50"
            >
              <ImageUp className="size-4" aria-hidden />
              {slip ? t("slipChange") : t("slipPick")}
            </label>
            <input
              id="buy-slip"
              type="file"
              accept={Object.keys(SLIP_TYPES).join(",")}
              className="sr-only"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">{t("slipHint")}</p>
            {slipError ? <p className="text-sm text-destructive">{slipError}</p> : null}
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={previewUrl} alt={t("slipPreview")} className="max-h-80 w-auto justify-self-center rounded-md border" />
            ) : null}
          </div>

          <Button size="lg" disabled={pending || !template || !slip} onClick={submit}>
            <Send /> {pending ? t("submitting") : t("submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
