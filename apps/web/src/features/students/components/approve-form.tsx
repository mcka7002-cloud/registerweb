"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunAction } from "@/features/admin/use-run-action";
import { approveRegistration } from "../actions";
import type { RegistrationPayload } from "../queries";
import { TextField } from "./text-field";

const STUDENT_FIELDS = [
  ["first_name", "text", true],
  ["last_name", "text", true],
  ["first_name_en", "text", true],
  ["last_name_en", "text", true],
  ["nickname", "text", false],
  ["birth_date", "date", true],
  ["height_cm", "number", false],
  ["weight_kg", "number", false],
  ["uniform_size", "text", false],
  ["medical_notes", "text", false],
  ["emergency_name", "text", false],
  ["emergency_phone", "tel", false],
] as const;
type FieldKey = (typeof STUDENT_FIELDS)[number][0] | "gender";

interface GuardianForm {
  full_name: string;
  nickname: string;
  relation: string;
  phones: string;
}

const str = (v: unknown) => (v == null ? "" : String(v));
const NO_GENDER = "none";

export function ApproveForm({ registrationId, payload }: { registrationId: string; payload: RegistrationPayload }) {
  const t = useTranslations("students");
  const router = useRouter();
  const { pending, run } = useRunAction();
  const [fields, setFields] = useState<Record<FieldKey, string>>(() => {
    const init = {} as Record<FieldKey, string>;
    for (const [k] of STUDENT_FIELDS) init[k] = str(payload[k]);
    init.gender = str(payload.gender);
    return init;
  });
  const [guardians, setGuardians] = useState<GuardianForm[]>(() =>
    (payload.guardians ?? []).slice(0, 2).map((g) => ({
      full_name: str(g.full_name),
      nickname: str(g.nickname),
      relation: str(g.relation),
      phones: (g.phones ?? []).join(", "),
    })),
  );

  const setField = (k: FieldKey, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const setGuardian = (i: number, k: keyof GuardianForm, v: string) =>
    setGuardians((gs) => gs.map((g, j) => (j === i ? { ...g, [k]: v } : g)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () =>
        approveRegistration({
          registration_id: registrationId,
          student: {
            ...fields,
            guardians: guardians.map((g) => ({
              full_name: g.full_name,
              nickname: g.nickname,
              relation: g.relation,
              phones: g.phones
                .split(/[,\s]+/)
                .map((p) => p.trim())
                .filter(Boolean)
                .slice(0, 3),
            })),
          },
        }),
      (d) => {
        toast.success(t("review.approved", { code: d.code }));
        router.push(`/staff/students/${d.student_id}`);
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {STUDENT_FIELDS.map(([k, type, required]) => (
          <TextField
            key={k}
            id={`a-${k}`}
            label={t(`fields.${k}`)}
            type={type}
            required={required}
            value={fields[k]}
            onChange={(v) => setField(k, v)}
          />
        ))}
        <div className="grid gap-2">
          <Label>{t("fields.gender")}</Label>
          <Select value={fields.gender || NO_GENDER} onValueChange={(v) => setField("gender", v === NO_GENDER ? "" : v)}>
            <SelectTrigger className="w-full" aria-label={t("fields.gender")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GENDER}>{t("genders.none")}</SelectItem>
              <SelectItem value="male">{t("genders.male")}</SelectItem>
              <SelectItem value="female">{t("genders.female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-semibold">{t("review.guardians")}</legend>
        {guardians.map((g, i) => (
          <div key={i} className="grid gap-4 rounded-md border p-3 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-sm font-medium">{t("review.guardian", { n: i + 1 })}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGuardians((gs) => gs.filter((_, j) => j !== i))}
              >
                <Trash2 /> {t("review.removeGuardian")}
              </Button>
            </div>
            <TextField id={`g${i}-name`} label={t("fields.full_name")} required value={g.full_name} onChange={(v) => setGuardian(i, "full_name", v)} />
            <TextField id={`g${i}-nick`} label={t("fields.nickname")} value={g.nickname} onChange={(v) => setGuardian(i, "nickname", v)} />
            <TextField id={`g${i}-rel`} label={t("fields.relation")} required value={g.relation} onChange={(v) => setGuardian(i, "relation", v)} />
            <TextField id={`g${i}-phones`} label={t("review.phones")} required type="tel" value={g.phones} onChange={(v) => setGuardian(i, "phones", v)} />
          </div>
        ))}
        {guardians.length < 2 ? (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setGuardians((gs) => [...gs, { full_name: "", nickname: "", relation: "", phones: "" }])}
          >
            <Plus /> {t("review.addGuardian")}
          </Button>
        ) : null}
      </fieldset>

      <Button type="submit" disabled={pending} className="justify-self-start">
        {t("review.approve")}
      </Button>
    </form>
  );
}
