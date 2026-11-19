"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
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
import { reviewVoid } from "../actions";
import { ReasonField } from "./reason-field";

/** Approve / reject one void request in "คิวตรวจ". PACKAGE_IN_USE stays visible inside the approve dialog. */
export function VoidReviewActions({ documentId, docNo }: { documentId: string; docNo: string }) {
  const t = useTranslations("control.queue");
  const tRoot = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openChange(next: "approve" | "reject" | null) {
    setMode(next);
    setReason("");
    setError(null);
  }

  function submit(approve: boolean) {
    startTransition(async () => {
      const res = await reviewVoid({ document_id: documentId, approve, reason });
      if (!res.ok) {
        setError(res.code);
        toast.error(tRoot(errorKey(res.code)));
        return;
      }
      toast.success(approve ? t("approved", { docNo }) : t("rejected", { docNo }));
      openChange(null);
      router.refresh();
    });
  }

  const errorBox = error ? (
    <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <p className="font-medium">{tRoot(errorKey(error))}</p>
      {error === "PACKAGE_IN_USE" ? <p className="mt-1">{t("inUseHint")}</p> : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Dialog open={mode === "reject"} onOpenChange={(o) => openChange(o ? "reject" : null)}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <X /> {t("reject")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle", { docNo })}</DialogTitle>
            <DialogDescription>{t("rejectHint")}</DialogDescription>
          </DialogHeader>
          <ReasonField
            id={`reject-${documentId}`}
            label={t("reason")}
            value={reason}
            onChange={setReason}
            placeholder={t("rejectPlaceholder")}
          />
          {errorBox}
          <DialogFooter>
            <Button variant="outline" onClick={() => openChange(null)}>
              {tRoot("actions.cancel")}
            </Button>
            <Button disabled={pending || reason.trim() === ""} onClick={() => submit(false)}>
              {t("rejectConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={mode === "approve"} onOpenChange={(o) => openChange(o ? "approve" : null)}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={pending}>
            <Check /> {t("approve")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approveTitle", { docNo })}</DialogTitle>
            <DialogDescription>{t("approveHint")}</DialogDescription>
          </DialogHeader>
          <ReasonField id={`approve-${documentId}`} label={t("approveNote")} value={reason} onChange={setReason} />
          {errorBox}
          <DialogFooter>
            <Button variant="outline" onClick={() => openChange(null)}>
              {tRoot("actions.cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => submit(true)}>
              {t("approveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
