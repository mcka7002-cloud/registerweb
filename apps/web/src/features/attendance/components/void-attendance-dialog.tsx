"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
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
import { voidAttendance } from "../actions";
import { ReasonField } from "./reason-field";

/** Admin only: "ยกเลิกการเช็คชื่อ" with a required reason → `void_attendance`. */
export function VoidAttendanceDialog({ sessionId, attendanceId }: { sessionId: string; attendanceId: string }) {
  const t = useTranslations("attendance.void");
  const tr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setReason("");
  }

  function submit() {
    startTransition(async () => {
      const res = await voidAttendance({ session_id: sessionId, attendance_id: attendanceId, reason });
      if (!res.ok) {
        toast.error(tr(errorKey(res.code)));
        return;
      }
      toast.success(t("done"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive-soft" size="lg">
          <Undo2 /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <ReasonField
          id={`void-reason-${attendanceId}`}
          label={t("reason")}
          value={reason}
          onChange={setReason}
          placeholder={t("reasonPlaceholder")}
        />
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            {tr("actions.cancel")}
          </Button>
          <Button variant="destructive" size="lg" disabled={pending || reason.trim() === ""} onClick={submit}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
