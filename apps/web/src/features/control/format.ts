/** Thai date + time in Bangkok, e.g. "16 พ.ย. 2569 14:05". */
export function formatThaiDateTime(iso: string, month: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month,
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}
