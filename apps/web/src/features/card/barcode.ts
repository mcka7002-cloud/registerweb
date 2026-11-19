// Server only: imported from server components (no `server-only` package in this project).
import { toSVG } from "bwip-js/node";
import QRCode from "qrcode";

/**
 * Adds `shape-rendering="crispEdges"` (bars print without anti-aliased blur) and fills the box the
 * CSS gives it. `stretch` lets a 1-D barcode widen evenly; a QR keeps its square.
 */
function crisp(svg: string, stretch: boolean): string {
  const attrs = [
    /shape-rendering=/.test(svg) ? "" : 'shape-rendering="crispEdges"',
    stretch ? 'preserveAspectRatio="none"' : "",
    'width="100%" height="100%"',
  ].filter(Boolean);
  return svg.replace(/<svg\b/, `<svg ${attrs.join(" ")}`);
}

/**
 * Code 128 of `students.code` as an SVG string (bars only; the code text is printed separately).
 * Null when the code cannot be encoded.
 */
export function code128Svg(code: string): string | null {
  try {
    return crisp(
      toSVG({
        bcid: "code128",
        text: code,
        scale: 2,
        height: 10,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      }),
      true,
    );
  } catch (err) {
    console.error("[code128Svg]", err);
    return null;
  }
}

/** QR of `students.code` as an SVG string. Null when it fails. */
export async function qrSvg(code: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return crisp(svg, false);
  } catch (err) {
    console.error("[qrSvg]", err);
    return null;
  }
}
