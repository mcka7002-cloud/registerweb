"use client";

import { useTranslations } from "next-intl";
import { errorKey } from "@/lib/utils";

/** Thai text for an action error code: `import.errors.<CODE>`, then common `errors.<CODE>`, else UNKNOWN. */
export function useImportErrorText() {
  const t = useTranslations();
  return (code: string): string => {
    if (t.has(`import.errors.${code}`)) return t(`import.errors.${code}`);
    return t(errorKey(code));
  };
}
