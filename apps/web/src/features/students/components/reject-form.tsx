"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRunAction } from "@/features/admin/use-run-action";
import { rejectRegistration } from "../actions";

export function RejectForm({ registrationId }: { registrationId: string }) {
  const t = useTranslations("students.review");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const { pending, run } = useRunAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => rejectRegistration({ registration_id: registrationId, reason }),
      () => {
        toast.success(t("rejected"));
        router.push("/staff/registrations");
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="r-reason">{t("reason")}</Label>
        <Input
          id="r-reason"
          required
          placeholder={t("reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button type="submit" variant="destructive" disabled={pending || reason.trim() === ""} className="justify-self-start">
        {t("reject")}
      </Button>
    </form>
  );
}
