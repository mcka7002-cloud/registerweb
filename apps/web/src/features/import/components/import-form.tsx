"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { importStudents, type ImportResult, type ImportRowError } from "../actions";
import { MAX_IMPORT_ROWS, parseImportCsv, type ImportColumn, type ImportRow } from "../csv";
import { useImportErrorText } from "./use-import-error-text";

type State =
  | { step: "pick" }
  | { step: "preview"; rows: ImportRow[]; result: ImportResult }
  | { step: "done"; created: number };

/** Upload → preview (`import_students` dry run) → import (commit) → result. */
export function ImportForm({ branchId }: { branchId: string }) {
  const t = useTranslations("import");
  const errorText = useImportErrorText();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "pick" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setState({ step: "pick" });
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setState({ step: "pick" });
    setFileError(null);
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError(t("fileErrors.READ_FAILED"));
      return;
    }
    const parsed = parseImportCsv(text);
    if (!parsed.ok) {
      setFileError(
        parsed.error === "MISSING_HEADERS"
          ? t("fileErrors.MISSING_HEADERS", { columns: (parsed.missing ?? []).join(", ") })
          : t("fileErrors.EMPTY_FILE"),
      );
      return;
    }
    if (parsed.rows.length === 0) {
      setFileError(t("fileErrors.NO_ROWS"));
      return;
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      setFileError(t("fileErrors.TOO_MANY", { count: parsed.rows.length, max: MAX_IMPORT_ROWS }));
      return;
    }

    const rows = parsed.rows;
    startTransition(async () => {
      const res = await importStudents({ branchId, rows, commit: false });
      if (!res.ok) {
        setFileError(errorText(res.code));
        return;
      }
      setState({ step: "preview", rows, result: res.data });
    });
  }

  function commit() {
    if (state.step !== "preview") return;
    const rows = state.rows;
    startTransition(async () => {
      const res = await importStudents({ branchId, rows, commit: true });
      if (!res.ok) {
        toast.error(errorText(res.code));
        return;
      }
      if (res.data.errors.length > 0) {
        // Data changed since the preview (e.g. a code was taken meanwhile): show the new errors.
        setState({ step: "preview", rows, result: res.data });
        return;
      }
      setState({ step: "done", created: res.data.created });
    });
  }

  if (state.step === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CircleCheck className="size-10 text-primary" aria-hidden />
          <p className="text-lg font-semibold">{t("done.title", { count: state.created })}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("done.description")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/staff/students">{t("done.toStudents")}</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              {t("done.again")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-3">
          <h2 className="font-semibold">{t("step2")}</h2>
          <div className="grid gap-2">
            <Label htmlFor="import-file">{t("fileLabel")}</Label>
            <label
              htmlFor="import-file"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-muted px-4 py-4 text-sm hover:bg-accent"
            >
              <FileUp className="size-5 text-primary" aria-hidden />
              <span className="text-muted-foreground">{pending ? t("checking") : t("fileHint")}</span>
            </label>
            <input
              ref={fileRef}
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={pending}
              onChange={onFile}
            />
          </div>
          {fileError ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {fileError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {state.step === "preview" ? (
        <Preview rows={state.rows} result={state.result} pending={pending} onCommit={commit} onReset={reset} />
      ) : null}
    </div>
  );
}

function Preview({
  rows,
  result,
  pending,
  onCommit,
  onReset,
}: {
  rows: ImportRow[];
  result: ImportResult;
  pending: boolean;
  onCommit: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("import");
  const errorText = useImportErrorText();
  const byRow = new Map<number, ImportRowError[]>();
  for (const e of result.errors) byRow.set(e.row, [...(byRow.get(e.row) ?? []), e]);
  const hasErrors = result.errors.length > 0;

  const bad = (rowNo: number, ...fields: ImportColumn[]) =>
    (byRow.get(rowNo) ?? []).some((e) => fields.includes(e.field));
  const cellClass = (isBad: boolean) => cn(isBad && "bg-destructive/10 font-medium text-destructive");
  const shown = (v: string) => v || "–";

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t("step3")}</h2>
            <p className="text-sm text-muted-foreground">{t("summary", { total: result.total })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onReset} disabled={pending}>
              {t("chooseAgain")}
            </Button>
            <Button onClick={onCommit} disabled={pending || hasErrors}>
              <Upload aria-hidden />
              {pending ? t("importing") : t("submit", { count: result.total })}
            </Button>
          </div>
        </div>

        {hasErrors ? (
          <p role="alert" className="rounded-xl bg-warning px-4 py-3 text-sm text-warning-foreground">
            {t("summaryErrors", { rows: byRow.size, count: result.errors.length })}
          </p>
        ) : (
          <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">{t("summaryOk")}</p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t("col.row")}</TableHead>
              <TableHead>{t("col.name")}</TableHead>
              <TableHead>{t("col.nameEn")}</TableHead>
              <TableHead>{t("col.code")}</TableHead>
              <TableHead>{t("col.belt")}</TableHead>
              <TableHead>{t("col.birthDate")}</TableHead>
              <TableHead>{t("col.problems")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const no = i + 1;
              const errs = byRow.get(no) ?? [];
              return (
                <TableRow key={no} className={cn(errs.length > 0 && "bg-destructive/5")}>
                  <TableCell className="font-medium">{no}</TableCell>
                  <TableCell className={cellClass(bad(no, "first_name", "last_name"))}>
                    {shown(`${r.first_name} ${r.last_name}`.trim())}
                    {r.nickname ? <span className="text-muted-foreground"> ({r.nickname})</span> : null}
                  </TableCell>
                  <TableCell className={cellClass(bad(no, "first_name_en", "last_name_en"))}>
                    {shown(`${r.first_name_en} ${r.last_name_en}`.trim())}
                  </TableCell>
                  <TableCell className={cellClass(bad(no, "code"))}>
                    {r.code ? r.code.toUpperCase() : <span className="text-muted-foreground">{t("newCode")}</span>}
                  </TableCell>
                  <TableCell className={cellClass(bad(no, "belt"))}>{r.belt || t("defaultBelt")}</TableCell>
                  <TableCell className={cellClass(bad(no, "birth_date"))}>{shown(r.birth_date)}</TableCell>
                  <TableCell>
                    {errs.length === 0 ? (
                      <span className="text-muted-foreground">{t("rowOk")}</span>
                    ) : (
                      <ul className="grid gap-0.5 text-destructive">
                        {errs.map((e) => (
                          <li key={`${e.field}-${e.code}`}>
                            <span className="font-medium">{t(`fields.${e.field}`)}</span>:{" "}
                            {t.has(`rowErrors.${e.code}`) ? t(`rowErrors.${e.code}`) : errorText(e.code)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
