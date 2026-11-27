import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatThaiDateTime } from "@/features/students/format";
import type { TrialInfo } from "../queries";
import { SKILLS, sessionDate, sessionTime } from "../shared";

/** Trial booking (date, class) and the saved assessment, read-only. */
export async function TrialSummary({ info }: { info: TrialInfo }) {
  const t = await getTranslations("trial");
  if (!info.session) return <p className="text-sm text-muted-foreground">{t("card.none")}</p>;
  const { notes } = info;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("card.when")}</dt>
      <dd className="font-medium">
        {sessionDate(info.session.class_date)} · {sessionTime(info.session)}
      </dd>
      <dt className="text-muted-foreground">{t("card.branch")}</dt>
      <dd>{info.branchName}</dd>
      {notes ? (
        <>
          <dt className="text-muted-foreground">{t("card.attended")}</dt>
          <dd>
            <Badge className={info.attendedAt ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
              {info.attendedAt ? t("attendedBadge") : t("absentBadge")}
            </Badge>
            {info.attendedAt ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {t("card.assessedAt")} {formatThaiDateTime(info.attendedAt)}
              </span>
            ) : null}
          </dd>
          {notes.scores
            ? SKILLS.map((k) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{t(`skills.${k}`)}</dt>
                  <dd className="flex items-center gap-1" aria-label={`${notes.scores?.[k] ?? "–"} / 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`size-3 rounded-full ${n <= (notes.scores?.[k] ?? 0) ? "bg-primary" : "bg-muted"}`}
                      />
                    ))}
                    <span className="ml-1 font-medium">{notes.scores?.[k] ?? "–"}</span>
                  </dd>
                </div>
              ))
            : null}
          <dt className="text-muted-foreground">{t("card.note")}</dt>
          <dd className="break-words">{notes.note || "–"}</dd>
          <dt className="text-muted-foreground">{t("card.recommended")}</dt>
          <dd>{info.recommendedName ?? "–"}</dd>
        </>
      ) : (
        <>
          <dt className="text-muted-foreground">{t("card.attended")}</dt>
          <dd className="text-muted-foreground">{t("card.noAssessment")}</dd>
        </>
      )}
    </dl>
  );
}
