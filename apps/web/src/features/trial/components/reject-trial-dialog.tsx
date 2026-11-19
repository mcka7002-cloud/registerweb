"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RejectForm } from "@/features/students/components/reject-form";

/** "ไม่รับ" after a trial: the existing reject form in a dialog. */
export function RejectTrialDialog({ registrationId }: { registrationId: string }) {
  const t = useTranslations("trial.next");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant="destructive-soft" className="min-h-12 px-8 text-base">
          <X /> {t("reject")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rejectTitle")}</DialogTitle>
          <DialogDescription>{t("rejectDescription")}</DialogDescription>
        </DialogHeader>
        <RejectForm registrationId={registrationId} />
      </DialogContent>
    </Dialog>
  );
}
