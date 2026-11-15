import { computeVat, type VatBreakdown, type VatSettings } from "@registerweb/domain";

/**
 * Display-only preview of what `request_package_purchase` will charge: template price plus the membership
 * price when included, through the same VAT helper the database mirrors. The database computes the real total.
 */
export function previewTotal(templatePrice: number, membershipPrice: number, withMembership: boolean, vat: VatSettings): VatBreakdown {
  return computeVat(templatePrice + (withMembership ? membershipPrice : 0), vat);
}

/** Key for a QR lookup by amount (two decimals). */
export const amountKey = (amount: number) => amount.toFixed(2);

/** Same limits as the `slips` bucket. */
export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const SLIP_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Message key for a payments action error code: feature-specific codes first, then the shared `errors.*`. */
export const PAYMENT_ERROR_CODES = ["SLIP_INVALID", "UPLOAD_FAILED", "INVALID_INPUT"] as const;
