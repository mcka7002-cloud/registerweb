import { getTranslations } from "next-intl/server";
import { formatBaht } from "@/lib/utils";
import { AUDIT_FIELDS, type AuditField } from "../audit";
import { formatThaiDateTime } from "../format";

const VALUE_KEYS = ["cash", "transfer", "promptpay", "slip", "scan", "manual", "online", "offline_sync"] as const;
const TEXT_FIELDS: AuditField[] = ["reason", "request_reason", "note"];

/** Readable summary of an audit row's `data` (known keys only, ids left out; reasons on their own line). */
export async function AuditDetails({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  const t = await getTranslations("control.audit");

  function value(key: AuditField, v: unknown): string | null {
    if (v === null || v === undefined || v === "") return null;
    switch (key) {
      case "total":
        return t("values.baht", { amount: formatBaht(Number(v)) });
      case "attended":
      case "whole_schedule":
      case "with_membership":
        return v === true ? t("values.yes") : t("values.no");
      case "method":
      case "source":
        return (VALUE_KEYS as readonly string[]).includes(String(v)) ? t(`values.${v as (typeof VALUE_KEYS)[number]}`) : String(v);
      case "trial_at":
        return formatThaiDateTime(String(v));
      case "teachers":
      case "packages":
        return Array.isArray(v) ? t("values.count", { count: v.length }) : null;
      default:
        return typeof v === "object" ? null : String(v);
    }
  }

  const facts: { key: AuditField; text: string }[] = [];
  const notes: { key: AuditField; text: string }[] = [];
  for (const key of AUDIT_FIELDS) {
    if (!(key in data)) continue;
    const text = value(key, data[key]);
    if (text === null) continue;
    (TEXT_FIELDS.includes(key) ? notes : facts).push({ key, text });
  }
  if (facts.length === 0 && notes.length === 0) return null;

  return (
    <div className="grid gap-0.5 text-xs">
      {facts.length > 0 ? (
        <p className="text-muted-foreground">
          {facts.map((f, i) => (
            <span key={f.key}>
              {i > 0 ? " · " : null}
              {t(`fields.${f.key}`)}: <span className="text-foreground">{f.text}</span>
            </span>
          ))}
        </p>
      ) : null}
      {notes.map((n) => (
        <p key={n.key}>
          <span className="text-muted-foreground">{t(`fields.${n.key}`)}:</span> {n.text}
        </p>
      ))}
    </div>
  );
}
