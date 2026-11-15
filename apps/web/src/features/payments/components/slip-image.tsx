"use client";

import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Slip thumbnail (signed URL); click to see it large in a dialog. */
export function SlipImage({ url }: { url: string | null }) {
  const t = useTranslations("payments.staff");
  if (!url) {
    return (
      <div className="flex h-40 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground">
        <ImageOff className="size-5" aria-hidden />
        {t("noSlip")}
      </div>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="block shrink-0 overflow-hidden rounded-md border" aria-label={t("slipOpen")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from local/hosted Supabase */}
          <img src={url} alt={t("slip")} className="h-40 w-32 object-cover" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[95vh] overflow-auto sm:max-w-2xl">
        <DialogTitle>{t("slip")}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img src={url} alt={t("slip")} className="mx-auto h-auto max-w-full rounded-md" />
      </DialogContent>
    </Dialog>
  );
}
