"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunAction } from "@/features/admin/use-run-action";
import { formatThaiDate } from "@/lib/utils";
import { bookSessions } from "../actions";
import type { SessionOption } from "../queries";

export interface BookablePackage {
  id: string;
  branch_id: string;
  name: string;
  remaining: number | null;
}

export function BookSessionsDialog({
  studentId,
  packages,
  sessionsByBranch,
  bookedSessionIds,
}: {
  studentId: string;
  packages: BookablePackage[];
  sessionsByBranch: Record<string, SessionOption[]>;
  bookedSessionIds: string[];
}) {
  const t = useTranslations("booking");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const { pending, run } = useRunAction();

  const pkg = packages.find((p) => p.id === packageId);
  const booked = useMemo(() => new Set(bookedSessionIds), [bookedSessionIds]);
  const sessions = pkg ? (sessionsByBranch[pkg.branch_id] ?? []) : [];

  function onOpenChange(next: boolean) {
    if (next) {
      setPackageId((id) => (packages.some((p) => p.id === id) ? id : (packages[0]?.id ?? "")));
      setSelected([]);
    }
    setOpen(next);
  }

  function toggle(id: string, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  function submit() {
    if (!pkg || selected.length === 0) return;
    run(
      () => bookSessions({ student_id: studentId, package_id: pkg.id, session_ids: selected }),
      (d) => {
        toast.success(t("booked", { count: d.booked }));
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlus /> {t("book")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{t("bookTitle")}</DialogTitle>
          <DialogDescription>{t("bookHint")}</DialogDescription>
        </DialogHeader>
        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPackages")}</p>
        ) : (
          <>
            <div className="grid gap-2">
              <Label>{t("pickPackage")}</Label>
              <Select
                value={packageId}
                onValueChange={(v) => {
                  setPackageId(v);
                  setSelected([]);
                }}
              >
                <SelectTrigger className="w-full" aria-label={t("pickPackage")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.remaining == null ? t("unlimited") : t("remaining", { count: p.remaining })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-h-0 gap-2">
              <Label>
                {t("sessions")} · {t("selected", { count: selected.length })}
              </Label>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
              ) : (
                <ul className="grid max-h-[45vh] gap-1 overflow-y-auto rounded-md border p-2">
                  {sessions.map((s) => {
                    const taken = booked.has(s.id);
                    return (
                      <li key={s.id}>
                        <label
                          className={`flex items-center gap-3 rounded px-2 py-1.5 text-sm ${taken ? "text-muted-foreground" : "cursor-pointer hover:bg-muted"}`}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            disabled={taken}
                            checked={taken || selected.includes(s.id)}
                            onChange={(e) => toggle(s.id, e.target.checked)}
                          />
                          <span className="flex-1">
                            {formatThaiDate(s.class_date, { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          <span className="tabular-nums">
                            {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}
                          </span>
                          {taken ? <span className="text-xs">{t("alreadyBooked")}</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tc("actions.cancel")}
          </Button>
          <Button type="button" disabled={pending || !pkg || selected.length === 0} onClick={submit}>
            {t("submit", { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
