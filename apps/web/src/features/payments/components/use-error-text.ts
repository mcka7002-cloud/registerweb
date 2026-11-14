"use client";

import { useTranslations } from "next-intl";
import { errorKey } from "@/lib/utils";
import { PAYMENT_ERROR_CODES } from "../shared";

/** Thai text for an RpcResult code: payments-only codes first, then the shared `errors.<CODE>` (else UNKNOWN). */
export function useErrorText() {
  const t = useTranslations();
  return (code: string): string =>
    (PAYMENT_ERROR_CODES as readonly string[]).includes(code) ? t(`payments.errors.${code}`) : t(errorKey(code));
}
