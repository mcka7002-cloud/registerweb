import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { cn, formatBaht } from "@/lib/utils";

/**
 * Small notice for a student card: "รอครูตรวจสลิป ยอด X บาท" (+ when it was sent).
 * Works in server and client components. `createdAt` is an ISO timestamp (e.g. `pending_order.created_at`).
 */
export function PendingOrderNotice({ total, createdAt, className }: { total: number; createdAt: string; className?: string }) {
  const t = useTranslations("payments.notice");
  const sent = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(createdAt));
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900",
        className,
      )}
    >
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="block font-medium">{t("pending", { amount: formatBaht(Number(total)) })}</span>
        <span className="block text-xs opacity-80">{t("sentAt", { date: sent })}</span>
      </span>
    </div>
  );
}
