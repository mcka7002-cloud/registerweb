"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
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
import type { Role } from "@/lib/auth";
import { saveUserAccess } from "../actions";
import type { UserRow } from "../queries";
import { useRunAction } from "../use-run-action";
import { CheckboxField } from "./checkbox-field";

const ROLES: Role[] = ["admin", "branch_manager", "teacher", "customer", "kiosk"];

export function UserAccessDialog({
  user,
  branches,
}: {
  user: UserRow;
  branches: { id: string; code: string; name: string }[];
}) {
  const t = useTranslations("admin.users");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [branchIds, setBranchIds] = useState<string[]>(user.branch_ids);
  const { pending, run } = useRunAction();

  function onOpenChange(next: boolean) {
    if (next) {
      setRole(user.role);
      setBranchIds(user.branch_ids);
    }
    setOpen(next);
  }

  function toggle(id: string, on: boolean) {
    setBranchIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => saveUserAccess({ profile_id: user.id, role, branch_ids: branchIds }),
      () => {
        toast.success(tc("status.saved"));
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil /> {t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>
              {user.full_name} · {user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>{t("role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full" aria-label={t("role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tc(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("branches")}</legend>
            {branches.map((b) => (
              <CheckboxField
                key={b.id}
                id={`u-${user.id}-${b.id}`}
                label={`${b.code} · ${b.name}`}
                checked={branchIds.includes(b.id)}
                onChange={(on) => toggle(b.id, on)}
              />
            ))}
            <p className="text-xs text-muted-foreground">{t("branchesHint")}</p>
          </fieldset>
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
