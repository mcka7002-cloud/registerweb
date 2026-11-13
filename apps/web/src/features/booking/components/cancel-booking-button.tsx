"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/features/admin/use-run-action";
import { cancelBooking } from "../actions";

export function CancelBookingButton({ studentId, bookingId, label }: { studentId: string; bookingId: string; label: string }) {
  const t = useTranslations("booking");
  const { pending, run } = useRunAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(label)) return;
        run(() => cancelBooking({ student_id: studentId, booking_id: bookingId }), () => toast.success(t("cancelled")));
      }}
    >
      {t("cancel")}
    </Button>
  );
}
