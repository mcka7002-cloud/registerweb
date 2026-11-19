/** Column headers of `public/templates/students-import.csv`, in template order (= `import_students` row keys). */
export const IMPORT_COLUMNS = [
  "code",
  "first_name",
  "last_name",
  "first_name_en",
  "last_name_en",
  "nickname",
  "birth_date",
  "gender",
  "belt",
  "membership_expires_on",
  "guardian_name",
  "guardian_relation",
  "guardian_phone",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Record<ImportColumn, string>;

/** Headers the file must have (the rest may be left out; missing ones are sent as empty). */
export const REQUIRED_COLUMNS: ImportColumn[] = ["first_name", "last_name", "first_name_en", "last_name_en", "birth_date"];

export const MAX_IMPORT_ROWS = 500;

/**
 * RFC 4180 parser: quoted fields, `""` escapes, commas and newlines inside quotes, CRLF / LF / CR,
 * leading BOM. Returns every record as an array of raw field strings.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      record.push(field);
      field = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export type ImportParseResult =
  | { ok: true; rows: ImportRow[] }
  | { ok: false; error: "EMPTY_FILE" | "MISSING_HEADERS"; missing?: ImportColumn[] };

const isBlank = (r: string[]) => r.every((f) => f.trim() === "");

/**
 * Parses the import file: first record = headers (trimmed, matched case-insensitively), each later
 * non-empty record → an object with every template column (unknown columns are ignored, missing = "").
 */
export function parseImportCsv(text: string): ImportParseResult {
  const records = parseCsv(text).filter((r) => !isBlank(r));
  if (records.length === 0) return { ok: false, error: "EMPTY_FILE" };

  const headers = records[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length > 0) return { ok: false, error: "MISSING_HEADERS", missing };

  const index = new Map<ImportColumn, number>();
  for (const c of IMPORT_COLUMNS) {
    const at = headers.indexOf(c);
    if (at >= 0) index.set(c, at);
  }

  const rows = records.slice(1).map((rec) => {
    const row = {} as ImportRow;
    for (const c of IMPORT_COLUMNS) {
      const at = index.get(c);
      row[c] = at === undefined ? "" : (rec[at] ?? "").trim();
    }
    return row;
  });
  return { ok: true, rows };
}
