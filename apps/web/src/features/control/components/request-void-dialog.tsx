"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import { toast } from "sonner";
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
import { errorKey } from "@/lib/utils";
import { requestVoid } from "../actions";
import { ReasonField } from "./reason-field";

/** "ขอยกเลิกใบเสร็จ": staff asks the admin to void this receipt, with a required reason. */
export function RequestVoidDialog({ documentId, docNo }: { documentId: string; docNo: string }) {
  const t = useTranslations("control.void");
  const tRoot = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await requestVoid({ document_id: documentId, reason });
      if (!res.ok) {
        toast.error(tRoot(errorKey(res.code)));
        return;
      }
      toast.success(t("sent"));
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive-soft">
          <Ban /> {t("request")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("requestTitle", { docNo })}</DialogTitle>
          <DialogDescription>{t("requestHint")}</DialogDescription>
        </DialogHeader>
        <ReasonField
          id="void-reason"
          label={t("reason")}
          value={reason}
          onChange={setReason}
          placeholder={t("reasonPlaceholder")}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tRoot("actions.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending || reason.trim() === ""} onClick={submit}>
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
