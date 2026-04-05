const DARK = "#111827";
const WHITE = "#ffffff";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (full.length !== 6) return null;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

// WCAG relative luminance
function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(L1: number, L2: number) {
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextStyle(bgHex?: string) {
  if (!bgHex || !bgHex.startsWith("#")) return null;

  const bgRgb = hexToRgb(bgHex);
  if (!bgRgb) return null;

  const bgL = luminance(bgRgb);

  const whiteL = 1; // luminance of white
  const darkRgb = hexToRgb(DARK)!;
  const darkL = luminance(darkRgb);

  const cWhite = contrastRatio(whiteL, bgL);
  const cDark = contrastRatio(darkL, bgL);

  const useDarkText = cDark >= cWhite;
  const color = useDarkText ? DARK : WHITE;

  // Orbit badges are small, so keep the dynamic text-color choice but use a
  // lighter touch on shadows: dark text generally reads cleanly without one,
  // while white text benefits from a subtle dark edge on saturated fills.
  const textShadow = useDarkText
    ? undefined
    : "0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.45)";

  return { color, textShadow, useDarkText };
}
