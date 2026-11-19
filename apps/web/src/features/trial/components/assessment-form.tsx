"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRunAction } from "@/features/admin/use-run-action";
import { cn, formatBaht } from "@/lib/utils";
import { recordTrial } from "../actions";
import type { TemplateOption } from "../queries";
import { SKILLS, type Skill, type TrialNotes } from "../shared";

const NONE = "none";
type Scores = Record<Skill, number | null>;

export function AssessmentForm({
  registrationId,
  templates,
  initial,
  initialAttended,
}: {
  registrationId: string;
  templates: TemplateOption[];
  initial: TrialNotes | null;
  initialAttended: boolean;
}) {
  const t = useTranslations("trial");
  const router = useRouter();
  const { pending, run } = useRunAction();
  const [attended, setAttended] = useState<boolean>(initial ? initialAttended : true);
  const [scores, setScores] = useState<Scores>(() => {
    const s = {} as Scores;
    for (const k of SKILLS) s[k] = initial?.scores?.[k] ?? null;
    return s;
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [templateId, setTemplateId] = useState<string>(
    initial?.recommended_template_id && templates.some((x) => x.id === initial.recommended_template_id)
      ? initial.recommended_template_id
      : NONE,
  );

  const complete = !attended || SKILLS.every((k) => scores[k] != null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) {
      toast.error(t("form.scoresRequired"));
      return;
    }
    run(
      () =>
        recordTrial({
          registration_id: registrationId,
          attended,
          scores,
          note,
          recommended_template_id: templateId === NONE ? null : templateId,
        }),
      () => {
        toast.success(t("form.saved"));
        router.refresh();
      },
    );
  }

  const choice = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border text-base font-semibold transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent hover:text-accent-foreground",
    );

  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-2 font-semibold">{t("form.attendedQuestion")}</legend>
        <div className="flex gap-3">
          <button type="button" aria-pressed={attended} className={choice(attended)} onClick={() => setAttended(true)}>
            <Check className="size-5" /> {t("form.yes")}
          </button>
          <button type="button" aria-pressed={!attended} className={choice(!attended)} onClick={() => setAttended(false)}>
            <X className="size-5" /> {t("form.no")}
          </button>
        </div>
      </fieldset>

      {attended ? (
        <fieldset className="grid gap-4">
          <legend className="mb-2 font-semibold">{t("form.scoresTitle")}</legend>
          {SKILLS.map((k) => (
            <div key={k} className="grid gap-2" role="radiogroup" aria-label={t(`skills.${k}`)}>
              <span className="text-sm font-medium">{t(`skills.${k}`)}</span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = scores[k] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={t("form.scoreLabel", { skill: t(`skills.${k}`), score: n })}
                      onClick={() => setScores((s) => ({ ...s, [k]: n }))}
                      className={cn(
                        "min-h-14 rounded-full border text-lg font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="trial-note">{t("form.note")}</Label>
        <textarea
          id="trial-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("form.notePlaceholder")}
          maxLength={2000}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-2">
        <Label>{t("form.recommended")}</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="h-12 w-full" aria-label={t("form.recommended")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("form.noRecommendation")}</SelectItem>
            {templates.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name} · ฿{formatBaht(x.price)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="min-h-12 justify-self-start px-8 text-base">
        <Check /> {pending ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
