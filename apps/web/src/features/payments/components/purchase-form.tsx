"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBaht } from "@/lib/utils";
import { submitPurchase } from "../actions";
import type { PurchaseOptions } from "../queries";
import { amountKey, previewTotal, SLIP_MAX_BYTES, SLIP_TYPES } from "../shared";
import { useErrorText } from "./use-error-text";

type Method = "promptpay" | "transfer";

/**
 * Every slip is re-encoded as JPEG in the browser (≈150 KB): keeps uploads fast and R2 storage small (ADR 0002).
 * 1200 px on the long side is enough to read a bank slip.
 */
const SHRINK_MAX_SIDE = 1200;
const SHRINK_QUALITY = 0.75;

async function shrinkImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", SHRINK_QUALITY));
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

  const tile = (selected: boolean) =>
    cn(
      "relative flex cursor-pointer flex-col gap-1 rounded-2xl border p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
      selected ? "border-2 border-primary bg-accent" : "hover:bg-muted",
    );

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("step1")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t("package")}</legend>
            {templates.map((x) => (
              <label key={x.id} className={tile(x.id === templateId)}>
                <input
                  type="radio"
                  name="template"
                  value={x.id}
                  checked={x.id === templateId}
                  onChange={() => setTemplateId(x.id)}
                  className="sr-only"
                />
                <span className="font-medium">{x.name}</span>
                <span className="text-lg font-semibold tabular-nums">{formatBaht(x.price)}</span>
                <span className="text-xs text-muted-foreground">
                  {x.sessions == null ? t("unlimited") : t("sessions", { count: x.sessions })} ·{" "}
                  {t("days", { count: x.duration_days })}
                </span>
              </label>
            ))}
          </fieldset>

          {options.membership_required ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                <span className="block font-medium">{membershipLabel}</span>
                <span className="block text-xs text-muted-foreground">{t("membershipRequired")}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatBaht(options.membership_price)}</span>
            </div>
          ) : (
            <label
              htmlFor="buy-membership"
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
            >
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

          <div className="rounded-2xl bg-muted p-4">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
              <dt className="text-muted-foreground">{t("net")}</dt>
              <dd className="text-right">{formatBaht(preview.net)}</dd>
              <dt className="text-muted-foreground">{vat.enabled ? t("vat", { rate: vat.rate }) : t("noVat")}</dt>
              <dd className="text-right">{formatBaht(preview.vat)}</dd>
              <dt className="font-semibold">{t("total")}</dt>
              <dd className="text-right text-lg font-semibold">
                {formatBaht(preview.total)} {t("baht")}
              </dd>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{t("previewNote")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("step2")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {methods.length > 1 ? (
            <fieldset className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <legend className="sr-only">{t("method")}</legend>
              {methods.map((m) => (
                <label
                  key={m}
                  className={cn(
                    "relative flex h-11 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    m === method ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m}
                    checked={m === method}
                    onChange={() => setMethod(m)}
                    className="sr-only"
                  />
                  {t(`methods.${m}`)}
                </label>
              ))}
            </fieldset>
          ) : null}

          {method === "promptpay" && payment.promptpay_id ? (
            <div className="grid justify-items-center gap-2 rounded-2xl border p-4 text-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG data URL
                <img
                  src={qr}
                  alt={t("qrAlt", { amount: formatBaht(preview.total) })}
                  className="size-56 bg-white p-2"
                />
              ) : null}
              <p className="text-xl font-semibold tabular-nums">
                {formatBaht(preview.total)} {t("baht")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("promptpayId")}: <span className="tabular-nums">{payment.promptpay_id}</span>
              </p>
              {qr ? <p className="text-xs text-muted-foreground">{t("qrHint")}</p> : null}
            </div>
          ) : null}

          {method === "transfer" && payment.bank_account ? (
            <div className="rounded-2xl border p-4 text-sm">
              <p className="font-medium">{t("bankAccount")}</p>
              <p className="whitespace-pre-line">{payment.bank_account}</p>
              <p className="mt-2 font-semibold tabular-nums">
                {t("total")} {formatBaht(preview.total)} {t("baht")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("step3")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label
            htmlFor="buy-slip"
            className="relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm hover:bg-muted/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
          >
            <Upload className="size-6 text-muted-foreground" aria-hidden />
            <span className="font-medium">{slip ? t("slipChange") : t("slipPick")}</span>
            <span className="text-xs text-muted-foreground">{t("slipHint")}</span>
            <input
              id="buy-slip"
              type="file"
              accept={Object.keys(SLIP_TYPES).join(",")}
              className="sr-only"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
          {slipError ? <p className="text-sm text-destructive">{slipError}</p> : null}
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img
              src={previewUrl}
              alt={t("slipPreview")}
              className="max-h-80 w-auto justify-self-center rounded-md border"
            />
          ) : null}
        </CardContent>
      </Card>

      <Button size="lg" className="h-11" disabled={pending || !template || !slip} onClick={submit}>
        <Send /> {pending ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
