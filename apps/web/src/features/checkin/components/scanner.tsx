"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn, errorKey } from "@/lib/utils";
import { checkIn } from "../actions";

type Outcome =
  | { kind: "ok"; name: string; nickname: string | null; remaining: number | null }
  | { kind: "duplicate" }
  | { kind: "rejected"; problem: string; name: string | null; nickname: string | null };

const RESULT_MS = 3000;

/** Full-screen scan screen: the input keeps focus; a Bluetooth scanner types the code and presses Enter. */
export function Scanner({
  branchId,
  sessionId,
  heading,
  changeSessionHref,
}: {
  branchId: string;
  sessionId: string;
  heading: string;
  changeSessionHref: string;
}) {
  const t = useTranslations("checkin");
  const tRoot = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const focus = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, []);

  const show = useCallback(
    (next: Outcome) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setOutcome(next);
      timerRef.current = setTimeout(() => setOutcome(null), RESULT_MS);
      focus();
    },
    [focus],
  );

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOutcome(null);
    focus();
  }, [focus]);

  useEffect(() => {
    focus();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [focus]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const barcode = code.trim();
    if (busyRef.current || barcode === "") return;
    busyRef.current = true;
    setBusy(true);
    setCode("");
    try {
      const res = await checkIn({
        clientUuid: crypto.randomUUID(),
        branchId,
        sessionId,
        barcode,
        scannedAt: new Date().toISOString(),
      });
      if (!res.ok) {
        show({ kind: "rejected", problem: tRoot(errorKey(res.code)), name: null, nickname: null });
      } else if (res.data.status === "ok") {
        show({
          kind: "ok",
          name: res.data.student_name ?? "",
          nickname: res.data.student ?? null,
          remaining: res.data.remaining ?? null,
        });
      } else if (res.data.status === "duplicate") {
        show({ kind: "duplicate" });
      } else {
        show({
          kind: "rejected",
          problem: res.data.problem ?? tRoot(errorKey("UNKNOWN")),
          name: res.data.student_name ?? null,
          nickname: res.data.student ?? null,
        });
      }
    } catch (err) {
      console.error("[kiosk] check-in failed", err);
      show({ kind: "rejected", problem: tRoot(errorKey("UNKNOWN")), name: null, nickname: null });
    } finally {
      busyRef.current = false;
      setBusy(false);
      focus();
    }
  }

  return (
    <div className="relative flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-8 py-5">
        <p className="text-2xl font-semibold">{heading}</p>
        <Button asChild variant="outline" size="lg">
          <Link href={changeSessionHref}>{t("changeSession")}</Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-8 pb-16">
        <p className="text-center text-3xl text-muted-foreground">{t("scanPrompt")}</p>
        <form onSubmit={onSubmit} className="flex w-full max-w-3xl gap-4">
          <label htmlFor="kiosk-code" className="sr-only">
            {t("inputLabel")}
          </label>
          <input
            id="kiosk-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={focus}
            readOnly={busy}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={t("inputLabel")}
            className="h-24 min-w-0 flex-1 rounded-xl border-2 border-input bg-transparent px-6 text-center font-mono text-5xl tracking-widest outline-none focus:border-ring focus:ring-4 focus:ring-ring/30"
          />
          <Button type="submit" disabled={busy} className="h-24 rounded-xl px-10 text-2xl">
            {busy ? t("checking") : t("submit")}
          </Button>
        </form>
      </main>

      {outcome ? (
        <button
          type="button"
          onClick={dismiss}
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-10 text-center text-white",
            outcome.kind === "ok" ? "bg-emerald-600" : outcome.kind === "duplicate" ? "bg-amber-500" : "bg-red-600",
          )}
        >
          {outcome.kind === "ok" ? (
            <>
              <CheckCircle2 className="size-32" aria-hidden />
              <p className="text-4xl font-semibold">{t("ok")}</p>
              {outcome.nickname ? <p className="text-7xl font-bold">{outcome.nickname}</p> : null}
              <p className={outcome.nickname ? "text-4xl" : "text-6xl font-bold"}>{outcome.name}</p>
              <p className="mt-4 text-5xl font-semibold">
                {outcome.remaining === null ? t("unlimited") : t("remaining", { count: outcome.remaining })}
              </p>
            </>
          ) : outcome.kind === "duplicate" ? (
            <>
              <CircleAlert className="size-32" aria-hidden />
              <p className="text-6xl font-bold">{t("duplicate")}</p>
            </>
          ) : (
            <>
              <XCircle className="size-32" aria-hidden />
              <p className="text-4xl font-semibold">{t("rejected")}</p>
              {outcome.nickname || outcome.name ? (
                <p className="text-5xl font-bold">{[outcome.nickname, outcome.name].filter(Boolean).join(" · ")}</p>
              ) : null}
              <p className="text-6xl font-bold">{outcome.problem}</p>
            </>
          )}
          <p className="absolute bottom-8 text-xl opacity-80">{t("tapToClose")}</p>
        </button>
      ) : null}
    </div>
  );
}
