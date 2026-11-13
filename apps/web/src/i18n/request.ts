import { getRequestConfig } from "next-intl/server";

/** Feature namespaces; each is loaded from messages/th/<feature>.json under its own key. */
export const FEATURE_NAMESPACES = ["admin", "students", "sales", "booking", "checkin", "portal", "register"] as const;

// Thai only, no locale in the URL.
export default getRequestConfig(async () => {
  const locale = "th";
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const features = await Promise.all(
    FEATURE_NAMESPACES.map(
      async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const,
    ),
  );

  return {
    locale,
    timeZone: "Asia/Bangkok",
    messages: { ...common, ...Object.fromEntries(features) },
  };
});
