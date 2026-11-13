"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSchedule, generateSessions, setScheduleActive } from "../actions";
import { useRunAction } from "../use-run-action";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function GenerateSessionsButton({ branchId }: { branchId: string }) {
  const t = useTranslations("admin.schedule");
  const { pending, run } = useRunAction();
  return (
    <Button
      disabled={pending}
      onClick={() => run(() => generateSessions(branchId), (d) => toast.success(t("generated", { count: d.created })))}
    >
      <CalendarPlus /> {t("generate")}
    </Button>
  );
}

export function ToggleScheduleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations("admin.schedule");
  const { pending, run } = useRunAction();
  return (
    <Button variant={isActive ? "outline" : "secondary"} size="sm" disabled={pending} onClick={() => run(() => setScheduleActive(id, !isActive))}>
      {isActive ? t("disable") : t("enable")}
    </Button>
  );
}

export function AddScheduleDialog({ branchId }: { branchId: string }) {
  const t = useTranslations("admin.schedule");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState("1");
  const [startsAt, setStartsAt] = useState("17:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const [capacity, setCapacity] = useState("");
  const { pending, run } = useRunAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        addSchedule({
          branch_id: branchId,
          weekday: Number(weekday),
          starts_at: startsAt.slice(0, 5),
          ends_at: endsAt.slice(0, 5),
          capacity: capacity === "" ? null : Number(capacity),
        }),
      () => {
        toast.success(tc("status.saved"));
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> {t("add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>{t("weekday")}</Label>
            <Select value={weekday} onValueChange={setWeekday}>
              <SelectTrigger className="w-full" aria-label={t("weekday")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {t(`days.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="s-start">{t("startsAt")}</Label>
              <Input id="s-start" type="time" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-end">{t("endsAt")}</Label>
              <Input id="s-end" type="time" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-cap">{t("capacity")}</Label>
            <Input id="s-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("capacityHint")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
