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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveTemplate, setTemplateActive } from "../actions";
import type { TemplateRow } from "../queries";
import { useRunAction } from "../use-run-action";
import { CheckboxField } from "./checkbox-field";

const ALL = "all";

interface FormState {
  branch: string;
  name: string;
  price: string;
  sessions: string;
  duration_days: string;
  makeup_allowed: string;
  sort_order: string;
  is_active: boolean;
}

function toForm(t?: TemplateRow): FormState {
  return {
    branch: t?.branch_id ?? ALL,
    name: t?.name ?? "",
    price: t ? String(t.price) : "",
    sessions: t?.sessions != null ? String(t.sessions) : "",
    duration_days: t ? String(t.duration_days) : "30",
    makeup_allowed: t ? String(t.makeup_allowed) : "1",
    sort_order: t ? String(t.sort_order) : "0",
    is_active: t?.is_active ?? true,
  };
}

export function TemplateDialog({
  template,
  branches,
  trigger,
}: {
  template?: TemplateRow;
  branches: { id: string; code: string; name: string }[];
  trigger: React.ReactNode;
}) {
  const t = useTranslations("admin.packages");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(toForm(template));
  const { pending, run } = useRunAction();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function onOpenChange(next: boolean) {
    if (next) setForm(toForm(template));
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        saveTemplate({
          id: template?.id ?? null,
          branch_id: form.branch === ALL ? null : form.branch,
          name: form.name,
          price: Number(form.price),
          sessions: form.sessions === "" ? null : Number(form.sessions),
          duration_days: Number(form.duration_days),
          makeup_allowed: Number(form.makeup_allowed),
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
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
            <DialogTitle>{template ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="p-name">{t("name")}</Label>
            <Input id="p-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>{t("branch")}</Label>
            <Select value={form.branch} onValueChange={(v) => set("branch", v)}>
              <SelectTrigger className="w-full" aria-label={t("branch")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allBranches")}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-price">{t("price")}</Label>
              <Input id="p-price" type="number" min={0} step="0.01" required value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-sessions">{t("sessions")}</Label>
              <Input id="p-sessions" type="number" min={1} placeholder={t("unlimited")} value={form.sessions} onChange={(e) => set("sessions", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-days">{t("durationDays")}</Label>
              <Input id="p-days" type="number" min={1} required value={form.duration_days} onChange={(e) => set("duration_days", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-makeup">{t("makeupAllowed")}</Label>
              <Input id="p-makeup" type="number" min={0} required value={form.makeup_allowed} onChange={(e) => set("makeup_allowed", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-sort">{t("sortOrder")}</Label>
              <Input id="p-sort" type="number" required value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("sessionsHint")}</p>
          <CheckboxField id="p-active" label={t("isActive")} checked={form.is_active} onChange={(v) => set("is_active", v)} />
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

export function ToggleTemplateButton({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations("admin.packages");
  const { pending, run } = useRunAction();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setTemplateActive(id, !isActive))}>
      {isActive ? t("deactivate") : t("activate")}
    </Button>
  );
}
