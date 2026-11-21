"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Users } from "lucide-react";
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
import { cn, errorKey } from "@/lib/utils";
import { setSessionTeachers } from "../actions";
import type { BranchStaff } from "../queries";

/** Admin / branch manager: pick the teachers of this session (optionally its whole weekly slot) → `set_session_teachers`. */
export function SessionTeachersDialog({
  sessionId,
  staff,
  current,
}: {
  sessionId: string;
  staff: BranchStaff[];
  current: string[];
}) {
  const t = useTranslations("attendance.teachers");
  const tr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(current);
  const [whole, setWhole] = useState(false);
  const [pending, startTransition] = useTransition();

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setSelected(current);
      setWhole(false);
    }
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function submit() {
    startTransition(async () => {
      const res = await setSessionTeachers({ session_id: sessionId, teacher_ids: selected, whole_schedule: whole });
      if (!res.ok) {
        toast.error(tr(errorKey(res.code)));
        return;
      }
      toast.success(t("saved", { count: res.data.sessions }));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Users /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        {staff.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{t("noStaff")}</p>
        ) : (
          <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
            {staff.map((p) => {
              const on = selected.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on ? "bg-accent text-accent-foreground" : "bg-muted hover:bg-accent/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                      )}
                    >
                      {on ? <Check className="size-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{t(`roles.${p.role as "teacher"}`)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={whole}
          onClick={() => setWhole((w) => !w)}
          className="flex min-h-14 items-center gap-4 rounded-2xl bg-muted px-4 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
              whole ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-5 rounded-full bg-background shadow transition-transform",
                whole ? "translate-x-6" : "translate-x-1",
              )}
            />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{t("wholeSchedule")}</span>
            <span className="block text-xs text-muted-foreground">{t("wholeScheduleHint")}</span>
          </span>
        </button>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
            {tr("actions.cancel")}
          </Button>
          <Button size="lg" disabled={pending} onClick={submit}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
