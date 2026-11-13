"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Receipt, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { computeVat } from "@registerweb/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunAction } from "@/features/admin/use-run-action";
import { formatBaht } from "@/lib/utils";
import { sellPackage, type SellResult } from "../actions";
import type { SaleContext } from "../queries";

const METHODS = ["cash", "transfer", "promptpay"] as const;
type Method = (typeof METHODS)[number];

export function SellPackageDialog({
  studentId,
  context,
  hasMembership,
  membershipDue,
}: {
  studentId: string;
  context: SaleContext;
  /** student has ever had a membership (→ renewal price) */
  hasMembership: boolean;
  /** membership missing or expired → checkbox default on */
  membershipDue: boolean;
}) {
  const t = useTranslations("sales");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(context.templates[0]?.id ?? "");
  const [withMembership, setWithMembership] = useState(membershipDue);
  const [method, setMethod] = useState<Method>("cash");
  const [result, setResult] = useState<SellResult | null>(null);
  const { pending, run } = useRunAction();

  const template = context.templates.find((x) => x.id === templateId);
  const membershipPrice = hasMembership ? context.membership.renewal : context.membership.new;
  const gross = (template?.price ?? 0) + (withMembership ? membershipPrice : 0);
  const preview = computeVat(gross, context.vat);

  function onOpenChange(next: boolean) {
    if (next) {
      setResult(null);
      setWithMembership(membershipDue);
      setMethod("cash");
      setTemplateId((id) => (context.templates.some((x) => x.id === id) ? id : (context.templates[0]?.id ?? "")));
    }
    setOpen(next);
  }

  function submit() {
    if (!template) return;
    run(
      () => sellPackage({ student_id: studentId, template_id: template.id, with_membership: withMembership, method }),
      (d) => {
        toast.success(t("sold", { docNo: d.doc_no }));
        setResult(d);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <ShoppingCart /> {t("sell")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sellTitle")}</DialogTitle>
          <DialogDescription>{t("sellHint")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-4">
            <p className="text-sm">{t("sold", { docNo: result.doc_no })}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBaht(Number(result.total))} {t("receipt.baht")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tc("actions.close")}
              </Button>
              <Button asChild>
                <Link href={`/receipts/${result.document_id}`}>
                  <Receipt /> {t("openReceipt")}
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : context.templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("template")}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-full" aria-label={t("template")}>
                  <SelectValue placeholder={t("pickTemplate")} />
                </SelectTrigger>
                <SelectContent>
                  {context.templates.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name} · {formatBaht(x.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {template ? (
                <p className="text-xs text-muted-foreground">
                  {template.sessions == null ? t("unlimited") : t("sessions", { count: template.sessions })} ·{" "}
                  {t("days", { count: template.duration_days })}
                </p>
              ) : null}
            </div>

            <label htmlFor="sell-membership" className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                id="sell-membership"
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={withMembership}
                onChange={(e) => setWithMembership(e.target.checked)}
              />
              <span>
                {t("withMembership")} ({hasMembership ? t("membershipRenewal") : t("membershipNew")}{" "}
                {formatBaht(membershipPrice)})
                {membershipDue ? <span className="block text-xs text-muted-foreground">{t("membershipDue")}</span> : null}
              </span>
            </label>

            <div className="grid gap-2">
              <Label>{t("method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger className="w-full" aria-label={t("method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-2 font-medium">{t("preview")}</p>
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
                <dt>{t("net")}</dt>
                <dd className="text-right">{formatBaht(preview.net)}</dd>
                <dt>{context.vat.enabled ? t("vat", { rate: context.vat.rate }) : t("noVat")}</dt>
                <dd className="text-right">{formatBaht(preview.vat)}</dd>
                <dt className="font-semibold">{t("total")}</dt>
                <dd className="text-right text-base font-semibold">{formatBaht(preview.total)}</dd>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">{t("previewNote")}</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tc("actions.cancel")}
              </Button>
              <Button disabled={pending || !template} onClick={submit}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
