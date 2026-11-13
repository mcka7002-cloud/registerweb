"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
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
import { useRunAction } from "@/features/admin/use-run-action";
import { updateStudent, type UpdateStudentInput } from "../actions";
import { TextField } from "./text-field";

type Fields = UpdateStudentInput["fields"];
type Key = keyof Fields;

const FIELDS: [Key, string, boolean][] = [
  ["first_name", "text", true],
  ["last_name", "text", true],
  ["first_name_en", "text", true],
  ["last_name_en", "text", true],
  ["nickname", "text", false],
  ["uniform_size", "text", false],
  ["height_cm", "number", false],
  ["weight_kg", "number", false],
  ["medical_notes", "text", false],
  ["emergency_name", "text", false],
  ["emergency_phone", "tel", false],
];

export type EditableStudent = Record<Key, string | number | null>;

const toForm = (s: EditableStudent) =>
  Object.fromEntries(FIELDS.map(([k]) => [k, s[k] == null ? "" : String(s[k])])) as Record<Key, string>;

export function EditStudentDialog({ studentId, student }: { studentId: string; student: EditableStudent }) {
  const t = useTranslations("students");
  const tc = useTranslations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(student));
  const { pending, run } = useRunAction();

  function onOpenChange(next: boolean) {
    if (next) setForm(toForm(student));
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => updateStudent({ student_id: studentId, fields: form }),
      () => {
        toast.success(tc("status.saved"));
        setOpen(false);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> {t("detail.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("detail.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([k, type, required]) => (
              <TextField
                key={k}
                id={`e-${k}`}
                label={t(`fields.${k}`)}
                type={type}
                required={required}
                value={form[k]}
                onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
              />
            ))}
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
