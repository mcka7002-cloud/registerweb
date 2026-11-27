"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserCheck } from "lucide-react";
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
import { staffCheckin } from "../actions";
import { ReasonField } from "./reason-field";

/** "เช็คชื่อแทน" for one student of the session: reason (quick picks) → `staff_checkin`. */
export function StaffCheckinDialog({ sessionId, studentId, studentLabel }: { sessionId: string; studentId: string; studentLabel: string }) {
  const t = useTranslations("attendance.checkin");
  const tr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setReason("");
      setProblem(null);
    }
  }

  function submit() {
    setProblem(null);
    startTransition(async () => {
      const res = await staffCheckin({
        client_uuid: crypto.randomUUID(),
        session_id: sessionId,
        student_id: studentId,
        reason,
      });
      if (!res.ok) {
        toast.error(tr(errorKey(res.code)));
        return;
      }
      const d = res.data;
      if (d.status === "ok") {
        const name = d.student || studentLabel;
        toast.success(
          d.remaining == null
            ? t("okUnlimited", { name })
            : t("okRemaining", { name, count: d.remaining }),
        );
        onOpenChange(false);
        router.refresh();
      } else if (d.status === "duplicate") {
        toast.info(t("duplicate"));
        onOpenChange(false);
        router.refresh();
      } else {
        setProblem(t("rejected", { problem: d.problem ?? "" }));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <UserCheck /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint", { name: studentLabel })}</DialogDescription>
        </DialogHeader>
        <ReasonField
          id={`checkin-reason-${studentId}`}
          label={t("reason")}
          value={reason}
          onChange={setReason}
          placeholder={t("reasonPlaceholder")}
          quickPicks={[t("quick.forgot"), t("quick.broken"), t("quick.scanFailed")]}
        />
        {problem ? (
          <p role="alert" className="rounded-xl bg-muted px-4 py-3 text-sm font-medium text-destructive">
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            {tr("actions.cancel")}
          </Button>
          <Button size="lg" disabled={pending || reason.trim() === ""} onClick={submit}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
