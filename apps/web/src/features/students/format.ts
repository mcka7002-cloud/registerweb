/** Timestamp (timestamptz ISO) as Thai date + time in Bangkok time. */
export function formatThaiDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

/** "17:00:00" → "17:00" */
export const hhmm = (time: string) => time.slice(0, 5);
