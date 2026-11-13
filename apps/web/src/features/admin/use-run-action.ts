"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RpcResult } from "@/lib/rpc";
import { errorKey } from "@/lib/utils";

/**
 * Runs a server action that returns RpcResult inside a transition.
 * Failure → toast with the Thai text for the code (common `errors.<CODE>`, then `admin.errors.<CODE>`, else UNKNOWN).
 * Shared by the back-office features (admin, students, sales, booking).
 */
export function useRunAction() {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  function messageFor(code: string): string {
    if (t.has(`errors.${code}`)) return t(`errors.${code}`);
    if (t.has(`admin.errors.${code}`)) return t(`admin.errors.${code}`);
    return t(errorKey(code));
  }

  function run<T>(action: () => Promise<RpcResult<T>>, onSuccess?: (data: T) => void) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(messageFor(res.code));
        return;
      }
      onSuccess?.(res.data);
    });
  }

  return { pending, run };
}
