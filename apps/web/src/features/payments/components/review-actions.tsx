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
import { Label } from "@/components/ui/label";
import { reviewOrder } from "../actions";
import { useErrorText } from "./use-error-text";

/** "ยืนยันรับเงิน" and "ปฏิเสธ" (with a required reason) for one pending slip order. */
export function ReviewActions({ orderId }: { orderId: string }) {
  const t = useTranslations("payments.staff");
  const tc = useTranslations("actions");
  const errorText = useErrorText();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const res = await reviewOrder({ order_id: orderId, approve: true });
      if (!res.ok) {
        toast.error(errorText(res.code));
        return;
      }
      const docId = res.data.document_id;
      toast.success(t("approved", { docNo: res.data.doc_no ?? "" }), {
        duration: 10000,
        action: docId ? { label: t("openReceipt"), onClick: () => router.push(`/receipts/${docId}`) } : undefined,
      });
      router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      const res = await reviewOrder({ order_id: orderId, approve: false, reason });
      if (!res.ok) {
        toast.error(errorText(res.code));
        return;
      }
      toast.success(t("rejected"));
      setRejectOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={pending}
            className="border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
          >
            <X /> {t("reject")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>{t("rejectHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`reason-${orderId}`}>{t("reason")}</Label>
            <textarea
              id={`reason-${orderId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" disabled={pending || reason.trim() === ""} onClick={reject}>
              {t("rejectConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button disabled={pending} onClick={approve}>
        <Check /> {t("approve")}
      </Button>
    </div>
  );
}
