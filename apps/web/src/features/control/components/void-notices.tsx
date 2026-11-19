import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import type { VoidInfo } from "../queries";
import { formatThaiDateTime } from "../format";

/** Staff-only notice above a receipt that has a void request waiting for the admin (hidden in print). */
export async function VoidPendingNotice({ info }: { info: VoidInfo }) {
  if (info.status !== "issued" || !info.requestedAt) return null;
  const t = await getTranslations("control");
  return (
    <div role="status" className="mx-auto mb-4 flex max-w-3xl gap-3 rounded-xl bg-warning p-4 text-sm text-warning-foreground print:hidden">
      <Clock className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="grid gap-1">
        <p className="font-semibold">{t("void.pendingTitle")}</p>
        {info.reason ? (
          <p>
            {t("audit.fields.reason")}: {info.reason}
          </p>
        ) : null}
        <p className="opacity-80">
          {t("void.pendingBy", { name: info.requestedBy ?? t("audit.unknownUser"), when: formatThaiDateTime(info.requestedAt) })}
        </p>
      </div>
    </div>
  );
}

/** Big "ยกเลิกแล้ว" stamp laid over a void receipt; prints too. */
export async function VoidStamp() {
  const t = await getTranslations("control.void");
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className="void-stamp -rotate-12 rounded-2xl border-8 border-destructive px-8 py-3 font-heading text-5xl font-bold tracking-wider text-destructive opacity-70 sm:text-7xl">
        {t("stamp")}
      </span>
    </div>
  );
}

/** Reason / who / when box at the top of a void receipt; prints too. */
export async function VoidReasonBox({ info }: { info: VoidInfo }) {
  const t = await getTranslations("control");
  return (
    <section className="void-box mb-4 rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-destructive">
      <p className="font-heading text-lg font-bold">{t("void.stamp")}</p>
      {info.reason ? (
        <p>
          {t("audit.fields.reason")}: {info.reason}
        </p>
      ) : null}
      <p className="text-xs">
        {info.voidedAt ? t("void.voidedAt", { when: formatThaiDateTime(info.voidedAt) }) : null}
        {info.voidedAt && info.voidedBy ? " · " : null}
        {info.voidedBy ? t("void.voidedBy", { name: info.voidedBy }) : null}
      </p>
    </section>
  );
}
