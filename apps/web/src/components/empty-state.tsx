import type { LucideIcon } from "lucide-react";
import { Mascot } from "@/components/brand";
import { cn } from "@/lib/utils";

/** Placeholder for an empty list or table: the mascot (or an icon), title, optional description and action. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl bg-muted px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="size-8 text-muted-foreground" aria-hidden /> : <Mascot className="h-24" />}
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
