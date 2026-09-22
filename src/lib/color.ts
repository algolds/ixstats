/**
 * Canonical Color Math & Conversion Utilities
 *
 * Zero-dependency, performant color parsing and space transformations:
 * - HSL (h: 0-360, s: 0-100, l: 0-100) <-> RGB (0-255) <-> HEX ("#rrggbb" or "#rrggbbaa")
 */

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HslaColor extends HslColor {
  a: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface RgbaColor extends RgbColor {
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

  let r = 0;
  let g = 0;
  let b = 0;

  if (hNorm < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hNorm < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hNorm < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hNorm < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hNorm < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
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
 * Converts hex color string to RGB object { r, g, b }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
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

/**
 * Parses any color format (hex, rgb, rgba, hsl, hsla, object) into normalized HSLA
 */
export function parseColorToHsl(input: unknown): HslaColor {
  if (!input) {
    return { h: 0, s: 0, l: 0, a: 1 };
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.h === "number" && typeof obj.s === "number" && typeof obj.l === "number") {
      return {
        h: obj.h,
        s: obj.s,
        l: obj.l,
        a: typeof obj.a === "number" ? obj.a : 1,
      };
    }
  }

  if (typeof input === "string") {
    const str = input.trim().toLowerCase();

    // Hex formats (#rgb, #rgba, #rrggbb, #rrggbbaa)
    if (str.startsWith("#")) {
      const hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16) || 0;
        const g = parseInt(hex[1] + hex[1], 16) || 0;
        const b = parseInt(hex[2] + hex[2], 16) || 0;
        const a = hex.length === 4 ? (parseInt(hex[3] + hex[3], 16) || 255) / 255 : 1;
        const [h, s, l] = rgbToHsl(r, g, b);
        return { h, s, l, a };
      } else if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16) || 0;
        const g = parseInt(hex.slice(2, 4), 16) || 0;
        const b = parseInt(hex.slice(4, 6), 16) || 0;
        const a = hex.length === 8 ? (parseInt(hex.slice(6, 8), 16) || 255) / 255 : 1;
        const [h, s, l] = rgbToHsl(r, g, b);
        return { h, s, l, a };
      }
    }

    // rgb/rgba format
    const rgbMatch = str.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.%]+))?\s*\)/
    );
    if (rgbMatch) {
      const r = parseFloat(rgbMatch[1] ?? "0") || 0;
      const g = parseFloat(rgbMatch[2] ?? "0") || 0;
      const b = parseFloat(rgbMatch[3] ?? "0") || 0;
      let a = 1;
      if (rgbMatch[4] !== undefined) {
        if (rgbMatch[4].endsWith("%")) {
          a = (parseFloat(rgbMatch[4]) || 100) / 100;
        } else {
          a = parseFloat(rgbMatch[4]) || 1;
        }
      }
      const [h, s, l] = rgbToHsl(r, g, b);
      return { h, s, l, a };
    }

    // hsl/hsla format
    const hslMatch = str.match(
      /hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.%]+))?\s*\)/
    );
    if (hslMatch) {
      const h = parseFloat(hslMatch[1] ?? "0") || 0;
      const s = parseFloat(hslMatch[2] ?? "0") || 0;
      const l = parseFloat(hslMatch[3] ?? "0") || 0;
      let a = 1;
      if (hslMatch[4] !== undefined) {
        if (hslMatch[4].endsWith("%")) {
          a = (parseFloat(hslMatch[4]) || 100) / 100;
        } else {
          a = parseFloat(hslMatch[4]) || 1;
        }
      }
      return { h, s, l, a };
    }
  }

  return { h: 0, s: 0, l: 0, a: 1 };
}
