import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Public page (see isPublicPath in lib/supabase/middleware.ts): parents read it before they sign in.
const SECTIONS = ["purposes", "data", "processors", "transfer", "retention", "rights", "children", "contact"] as const;
const WITH_BODY = new Set<(typeof SECTIONS)[number]>(["processors", "transfer", "retention", "rights", "children", "contact"]);
const WITH_ITEMS = new Set<(typeof SECTIONS)[number]>(["purposes", "data", "processors", "rights"]);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const tApp = await getTranslations("app");

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-muted px-4 py-10">
      <Link href="/login">
        <BrandLogo alt={tApp("logoAlt")} priority className="h-16 sm:h-20" />
      </Link>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("updated", { date: t("updatedDate") })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 text-sm leading-relaxed">
          <p>{t("intro")}</p>
          {SECTIONS.map((key) => (
            <section key={key} id={key} className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t(`sections.${key}.title`)}</h2>
              {WITH_BODY.has(key) ? <p>{t(`sections.${key}.body`)}</p> : null}
              {WITH_ITEMS.has(key) ? (
                <ul className="list-disc space-y-1 pl-5">
                  {(t.raw(`sections.${key}.items`) as string[]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </CardContent>
      </Card>
      <Link href="/login" className="text-sm text-muted-foreground underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
