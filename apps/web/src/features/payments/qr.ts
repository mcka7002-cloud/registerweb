import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/** Digits only; PromptPay ids are a 10-digit phone, 13-digit tax id or 15-digit e-wallet id. */
function normalizeId(id: string): string | null {
  const digits = id.replace(/\D/g, "");
  return [10, 13, 15].includes(digits.length) ? digits : null;
}

/**
 * PromptPay QR (Thai QR payment payload with the exact amount) as an SVG data URL, rendered on the server.
 * Null when the id is not a valid PromptPay id.
 */
export async function promptPayQrDataUrl(promptpayId: string, amount: number): Promise<string | null> {
  const id = normalizeId(promptpayId);
  if (!id) return null;
  try {
    const payload = generatePayload(id, { amount: Math.round(amount * 100) / 100 });
    const svg = await QRCode.toString(payload, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch (err) {
    console.error("[promptPayQrDataUrl]", err);
    return null;
  }
}
