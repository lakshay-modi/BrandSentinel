// Colour maths shared by the browser (image analysis) and the server (rule checks).

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: RGB | string, b: RGB | string): number {
  const la = luminance(typeof a === "string" ? hexToRgb(a) : a);
  const lb = luminance(typeof b === "string" ? hexToRgb(b) : b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Straight-line distance between two colours in RGB space (0 to ~441). */
export function colourDistance(a: RGB | string, b: RGB | string): number {
  const x = typeof a === "string" ? hexToRgb(a) : a;
  const y = typeof b === "string" ? hexToRgb(b) : b;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
