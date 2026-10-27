/**
 * Canonical Color Math & Conversion Utilities
 *
 * Zero-dependency, performant color parsing and space transformations:
 * - HSL (h: 0-360, s: 0-100, l: 0-100) <-> RGB (0-255) <-> HEX ("#rrggbb" or "#rrggbbaa")
 */

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface HslaColor extends HslColor {
  a: number;
}

/**
 * Converts HSL color values to hex string "#rrggbb"
 * @param h Hue in degrees [0, 360)
 * @param s Saturation percentage [0, 100]
 * @param l Lightness percentage [0, 100]
 */
export function hslToHex(h: number, s: number, l: number): string {
  if (isNaN(h) || isNaN(s) || isNaN(l)) {
    return "#000000";
  }

  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);

  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`.toLowerCase();
}

/**
 * Converts HSL to RGB [0-255, 0-255, 0-255] tuple
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;

  const sextants = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = sextants[hNorm < 300 ? Math.floor(hNorm / 60) : 5]!;

  return [Math.round((r! + m) * 255), Math.round((g! + m) * 255), Math.round((b! + m) * 255)];
}

/**
 * Converts RGB values [0-255] to HSL tuple [h (0-360), s (0-100), l (0-100)]
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rNorm = Math.max(0, Math.min(255, r)) / 255;
  const gNorm = Math.max(0, Math.min(255, g)) / 255;
  const bNorm = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) * 60;
    } else {
      h = ((rNorm - gNorm) / delta + 4) * 60;
    }
  }

  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Converts RGB values to hex string "#rrggbb". Channels are rounded and clamped to [0, 255];
 * NaN becomes 0.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, Number.isNaN(v) ? 0 : v)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts hex color string to RGB object { r, g, b }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "").trim();
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.substring(i, i + 2), 16) || 0) as [
    number,
    number,
    number,
  ];
  return { r, g, b };
}

/**
 * Converts hex color string to RGB array [r, g, b]
 */
export function hexToRgbArray(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  return [r, g, b];
}

/**
 * Converts hex color string to HSL object { h, s, l }
 */
export function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return { h, s, l };
}

const BLACK: HslaColor = { h: 0, s: 0, l: 0, a: 1 };

/** CSS alpha: a number, or a percentage; unparseable / zero values fall back to opaque. */
function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith("%") ? (parseFloat(raw) || 100) / 100 : parseFloat(raw) || 1;
}

/** #rgb, #rgba, #rrggbb or #rrggbbaa (without the "#") to HSLA; undefined for other lengths. */
function parseHexToHsl(hex: string): HslaColor | undefined {
  if (![3, 4, 6, 8].includes(hex.length)) return undefined;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [
    number,
    number,
    number,
  ];
  const [h, s, l] = rgbToHsl(r, g, b);
  const a = full.length === 8 ? (parseInt(full.slice(6, 8), 16) || 255) / 255 : 1;
  return { h, s, l, a };
}

/**
 * Parses any color format (hex, rgb, rgba, hsl, hsla, object) into normalized HSLA
 */
export function parseColorToHsl(input: unknown): HslaColor {
  if (!input) return BLACK;

  if (typeof input === "object") {
    const { h, s, l, a } = input as Record<string, unknown>;
    if (typeof h === "number" && typeof s === "number" && typeof l === "number") {
      return { h, s, l, a: typeof a === "number" ? a : 1 };
    }
  }
  if (typeof input !== "string") return BLACK;

  const str = input.trim().toLowerCase();
  if (str.startsWith("#")) {
    const parsed = parseHexToHsl(str.slice(1));
    if (parsed) return parsed;
  }

  const rgb = str.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.%]+))?\s*\)/
  );
  if (rgb) {
    const [r, g, b] = [1, 2, 3].map((i) => parseFloat(rgb[i] ?? "0") || 0) as [
      number,
      number,
      number,
    ];
    const [h, s, l] = rgbToHsl(r, g, b);
    return { h, s, l, a: parseAlpha(rgb[4]) };
  }

  const hsl = str.match(
    /hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.%]+))?\s*\)/
  );
  if (hsl) {
    const [h, s, l] = [1, 2, 3].map((i) => parseFloat(hsl[i] ?? "0") || 0) as [
      number,
      number,
      number,
    ];
    return { h, s, l, a: parseAlpha(hsl[4]) };
  }

  return BLACK;
}
