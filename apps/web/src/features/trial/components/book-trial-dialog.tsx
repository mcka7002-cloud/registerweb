"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check } from "lucide-react";
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
import { useRunAction } from "@/features/admin/use-run-action";
import { cn } from "@/lib/utils";
import { bookTrial } from "../actions";
import type { SessionSlot } from "../queries";
import { sessionDate, sessionTime } from "../shared";

export function BookTrialDialog({
  registrationId,
  branchName,
  sessions,
  currentSessionId,
}: {
  registrationId: string;
  branchName: string;
  sessions: SessionSlot[];
  currentSessionId: string | null;
}) {
  const t = useTranslations("trial.book");
  const router = useRouter();
  const { pending, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(currentSessionId);

  const byDate = new Map<string, SessionSlot[]>();
  for (const s of sessions) byDate.set(s.class_date, [...(byDate.get(s.class_date) ?? []), s]);

  function submit() {
    if (!picked) return;
    const s = sessions.find((x) => x.id === picked);
    run(
      () => bookTrial({ registration_id: registrationId, session_id: picked }),
      () => {
        toast.success(t("success", { date: s ? `${sessionDate(s.class_date)} ${sessionTime(s)}` : "" }));
        setOpen(false);
        router.refresh();
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPicked(currentSessionId);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant={currentSessionId ? "outline" : "default"}>
          <CalendarPlus /> {currentSessionId ? t("rebook") : t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { branch: branchName })}
            {currentSessionId ? <span className="mt-1 block text-destructive">{t("rebookWarning")}</span> : null}
          </DialogDescription>
        </DialogHeader>
        {sessions.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noSessions")}</p>
        ) : (
          <div className="grid max-h-[50vh] gap-4 overflow-y-auto pr-1">
            {[...byDate.entries()].map(([date, slots]) => (
              <div key={date} className="grid gap-2">
                <p className="text-sm font-semibold">{sessionDate(date)}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const active = picked === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPicked(s.id)}
                        className={cn(
                          "min-h-12 rounded-full border px-5 text-base font-medium transition-colors",
                          active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        {sessionTime(s)}
                        {s.id === currentSessionId ? <span className="ml-2 text-xs">({t("current")})</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button size="lg" disabled={pending || !picked || picked === currentSessionId} onClick={submit}>
            <Check /> {pending ? t("saving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
