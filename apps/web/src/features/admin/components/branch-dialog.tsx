"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBranch } from "../actions";
import type { BranchRow } from "../queries";
import { useRunAction } from "../use-run-action";
import { CheckboxField } from "./checkbox-field";

const EMPTY: BranchRow = {
  id: "",
  code: "",
  name: "",
  address: "",
  tax_id: "",
  vat_enabled: false,
  vat_inclusive: true,
  vat_rate: 7,
};

/** Create (no `branch`) or edit a branch and its VAT settings. */
export function BranchDialog({ branch, trigger }: { branch?: BranchRow; trigger: React.ReactNode }) {
  const t = useTranslations("admin.branches");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BranchRow>(branch ?? EMPTY);
  const { pending, run } = useRunAction();

  const set = <K extends keyof BranchRow>(key: K, value: BranchRow[K]) => setForm((f) => ({ ...f, [key]: value }));

  function onOpenChange(next: boolean) {
    if (next) setForm(branch ?? EMPTY);
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        saveBranch({
          id: form.id || null,
          code: form.code,
          name: form.name,
          address: form.address ?? "",
          tax_id: form.tax_id ?? "",
          vat_enabled: form.vat_enabled,
          vat_inclusive: form.vat_inclusive,
          vat_rate: Number(form.vat_rate),
        }),
      () => {
        toast.success(tc("status.saved"));
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{branch ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="b-code">{t("code")}</Label>
              <Input id="b-code" required maxLength={10} value={form.code} onChange={(e) => set("code", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-name">{t("name")}</Label>
              <Input id="b-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("codeHint")}</p>
          <div className="grid gap-2">
            <Label htmlFor="b-address">{t("address")}</Label>
            <Input id="b-address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-tax">{t("taxId")}</Label>
            <Input id="b-tax" value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
          </div>
          <fieldset className="grid gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{t("vat")}</legend>
            <CheckboxField id="b-vat" label={t("vatEnabled")} checked={form.vat_enabled} onChange={(v) => set("vat_enabled", v)} />
            <CheckboxField
              id="b-vat-inc"
              label={t("vatInclusive")}
              checked={form.vat_inclusive}
              disabled={!form.vat_enabled}
              onChange={(v) => set("vat_inclusive", v)}
            />
            <div className="grid max-w-40 gap-2">
              <Label htmlFor="b-vat-rate">{t("vatRate")}</Label>
              <Input
                id="b-vat-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                disabled={!form.vat_enabled}
                value={form.vat_rate}
                onChange={(e) => set("vat_rate", Number(e.target.value))}
              />
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
