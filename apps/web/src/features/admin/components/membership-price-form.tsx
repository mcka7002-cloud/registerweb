"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMembershipPrices } from "../actions";
import { useRunAction } from "../use-run-action";

export function MembershipPriceForm({ initial }: { initial: { membership_new: number; membership_renewal: number } }) {
  const t = useTranslations("admin.packages");
  const tc = useTranslations();
  const [newPrice, setNewPrice] = useState(String(initial.membership_new));
  const [renewal, setRenewal] = useState(String(initial.membership_renewal));
  const { pending, run } = useRunAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => saveMembershipPrices({ membership_new: Number(newPrice), membership_renewal: Number(renewal) }),
      () => toast.success(tc("status.saved")),
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="m-new">{t("membershipNew")}</Label>
        <Input id="m-new" type="number" min={0} step="0.01" required value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="m-renew">{t("membershipRenewal")}</Label>
        <Input id="m-renew" type="number" min={0} step="0.01" required value={renewal} onChange={(e) => setRenewal(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending}>
        {tc("actions.save")}
      </Button>
    </form>
  );
}
