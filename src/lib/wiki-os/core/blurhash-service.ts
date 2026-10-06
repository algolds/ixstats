/**
 * blurhash-service.ts — WikiOS BlurHash placeholders (WK-17).
 *
 * A zero-dependency implementation of the BlurHash format (https://blurha.sh): `decode` gives the same pixels as the
 * reference `blurhash` package, and `encode` follows the reference C encoder (the largest AC component by absolute
 * value sets the scale, so any BlurHash decoder reads it). `encode` turns RGBA pixels into a short string, `decode` turns the string back into
 * a blurred picture, and `placeholderDataUri` draws that picture as a small blurred SVG, a data URI any `<img>` or CSS
 * background can show while the real file loads. Pure functions, safe on the server and in the browser.
 *
 * The pixels come from the file itself (`image-blurhash.ts`, on upload and in the backfill script): an asset with no
 * blurhash (an SVG, a PDF, a file that could not be decoded, one nobody has read yet) gets `createPlaceholderSvg`, a
 * flat box of the file's shape.
 */

const DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

/** The blurred grid `placeholderDataUri` draws: at most this many cells on the longer side. */
const PLACEHOLDER_CELLS = 8;

type Rgb = [number, number, number];

function sRgbToLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSRgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308
    ? Math.trunc(v * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
}

function signPow(value: number, exponent: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

function hex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export class BlurHashService {
  /**
   * Decodes an 83-base integer from a BlurHash substring.
   */
  static decode83(str: string): number {
    let value = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const digit = DIGITS.indexOf(c);
      if (digit !== -1) {
        value = value * 83 + digit;
      }
    }
    return value;
  }

  /**
   * Encodes an integer into an 83-base string.
   */
  static encode83(value: number, length: number): string {
    let result = "";
    for (let i = 1; i <= length; i++) {
      const digit = Math.floor(value / Math.pow(83, length - i)) % 83;
      result += DIGITS[digit];
    }
    return result;
  }

  /**
   * The BlurHash of an RGBA picture (`pixels` holds 4 bytes per pixel, row by row) with `componentsX` × `componentsY`
   * cosine components (1 to 9 each; 4 × 3 is the usual choice). Throws on bad arguments.
   */
  static encode(
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    componentsX: number,
    componentsY: number
  ): string {
    if (componentsX < 1 || componentsX > 9 || componentsY < 1 || componentsY > 9) {
      throw new Error("BlurHash components must be between 1 and 9.");
    }
    if (width < 1 || height < 1 || pixels.length !== width * height * 4) {
      throw new Error("BlurHash pixels do not match the width and height.");
    }

    // Linear light, once per pixel: the basis loops below read each pixel componentsX × componentsY times
    const linear = new Float64Array(width * height * 3);
    for (let p = 0; p < width * height; p++) {
      linear[p * 3] = sRgbToLinear(pixels[p * 4]!);
      linear[p * 3 + 1] = sRgbToLinear(pixels[p * 4 + 1]!);
      linear[p * 3 + 2] = sRgbToLinear(pixels[p * 4 + 2]!);
    }

    const factors: Rgb[] = [];
    for (let y = 0; y < componentsY; y++) {
      for (let x = 0; x < componentsX; x++) {
        const normalisation = x === 0 && y === 0 ? 1 : 2;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < height; j++) {
          const basisY = Math.cos((Math.PI * y * j) / height);
          for (let i = 0; i < width; i++) {
            const basis = normalisation * Math.cos((Math.PI * x * i) / width) * basisY;
            const p = (j * width + i) * 3;
            r += basis * linear[p]!;
            g += basis * linear[p + 1]!;
            b += basis * linear[p + 2]!;
          }
        }
        const scale = 1 / (width * height);
        factors.push([r * scale, g * scale, b * scale]);
      }
    }

    const [dc, ...ac] = factors as [Rgb, ...Rgb[]];
    let hash = this.encode83(componentsX - 1 + (componentsY - 1) * 9, 1);

    let maximumValue = 1;
    if (ac.length > 0) {
      const actualMaximum = Math.max(...ac.flatMap((f) => f.map(Math.abs)));
      const quantisedMaximum = Math.floor(
        Math.max(0, Math.min(82, Math.floor(actualMaximum * 166 - 0.5)))
      );
      maximumValue = (quantisedMaximum + 1) / 166;
      hash += this.encode83(quantisedMaximum, 1);
    } else {
      hash += this.encode83(0, 1);
    }

    hash += this.encode83(
      (linearToSRgb(dc[0]) << 16) + (linearToSRgb(dc[1]) << 8) + linearToSRgb(dc[2]),
      4
    );
    for (const factor of ac) {
      const [qr, qg, qb] = factor.map((c) =>
        Math.floor(Math.max(0, Math.min(18, Math.floor(signPow(c / maximumValue, 0.5) * 9 + 9.5))))
      ) as Rgb;
      hash += this.encode83(qr * 19 * 19 + qg * 19 + qb, 2);
    }
    return hash;
  }

  /** The number of components (x, y) of a well-formed BlurHash, or null when `hash` is not one. */
  static components(hash: string | null | undefined): { x: number; y: number } | null {
    if (!hash || hash.length < 6) return null;
    for (const c of hash) if (!DIGITS.includes(c)) return null;
    const sizeFlag = this.decode83(hash[0]!);
    const x = (sizeFlag % 9) + 1;
    const y = Math.floor(sizeFlag / 9) + 1;
    return hash.length === 4 + 2 * x * y ? { x, y } : null;
  }

  /** Whether `hash` is a well-formed BlurHash. */
  static isValid(hash: string | null | undefined): hash is string {
    return this.components(hash) !== null;
  }

  /**
   * The picture a BlurHash stands for, `width` × `height` RGBA pixels (alpha always 255); null when `hash` is not a
   * well-formed BlurHash. `punch` (1 by default) raises or lowers the contrast.
   */
  static decode(hash: string, width: number, height: number, punch = 1): Uint8ClampedArray | null {
    const size = this.components(hash);
    if (!size || width < 1 || height < 1) return null;

    const maximumValue = ((this.decode83(hash[1]!) + 1) / 166) * punch;
    const colors: Rgb[] = [];
    const dc = this.decode83(hash.substring(2, 6));
    colors.push([sRgbToLinear(dc >> 16), sRgbToLinear((dc >> 8) & 255), sRgbToLinear(dc & 255)]);
    for (let i = 1; i < size.x * size.y; i++) {
      const value = this.decode83(hash.substring(4 + i * 2, 6 + i * 2));
      colors.push([
        signPow((Math.floor(value / (19 * 19)) - 9) / 9, 2) * maximumValue,
        signPow(((Math.floor(value / 19) % 19) - 9) / 9, 2) * maximumValue,
        signPow(((value % 19) - 9) / 9, 2) * maximumValue,
      ]);
    }

    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < size.y; j++) {
          const basisY = Math.cos((Math.PI * y * j) / height);
          for (let i = 0; i < size.x; i++) {
            const basis = Math.cos((Math.PI * x * i) / width) * basisY;
            const color = colors[i + j * size.x]!;
            r += color[0] * basis;
            g += color[1] * basis;
            b += color[2] * basis;
          }
        }
        const p = 4 * (x + y * width);
        pixels[p] = linearToSRgb(r);
        pixels[p + 1] = linearToSRgb(g);
        pixels[p + 2] = linearToSRgb(b);
        pixels[p + 3] = 255;
      }
    }
    return pixels;
  }

  /**
   * A blurred SVG of the picture a BlurHash stands for, as a data URI, in the shape `width` × `height` (the file's
   * size; 4 × 3 when it is not known); null when `hash` is not a well-formed BlurHash. The hash is decoded to a grid of
   * at most 8 cells on the longer side, which the SVG blurs: a few hundred bytes, whatever the file's size.
   */
  static placeholderDataUri(
    hash: string | null | undefined,
    width?: number | null,
    height?: number | null
  ): string | null {
    if (!this.isValid(hash)) return null;
    const w = width && width > 0 ? width : 4;
    const h = height && height > 0 ? height : 3;
    const cols = w >= h ? PLACEHOLDER_CELLS : Math.max(1, Math.round((PLACEHOLDER_CELLS * w) / h));
    const rows = h >= w ? PLACEHOLDER_CELLS : Math.max(1, Math.round((PLACEHOLDER_CELLS * h) / w));
    const pixels = this.decode(hash, cols, rows);
    if (!pixels) return null;

    const cells: string[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const p = 4 * (x + y * cols);
        cells.push(
          `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${hex([pixels[p]!, pixels[p + 1]!, pixels[p + 2]!])}"/>`
        );
      }
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none">` +
      `<filter id="b" x="0" y="0" width="1" height="1"><feGaussianBlur stdDeviation="0.6" edgeMode="duplicate"/></filter>` +
      `<g filter="url(#b)">${cells.join("")}</g></svg>`;
    // Parentheses and quotes escaped too: the URI is used inside CSS `url("...")`
    const encoded = encodeURIComponent(svg).replace(
      /[()']/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
    return `data:image/svg+xml;utf8,${encoded}`;
  }

  /**
   * The placeholder of an asset: its BlurHash drawn (`placeholderDataUri`) when it has one, else a flat box of its
   * shape (`createPlaceholderSvg`, the size only).
   */
  static placeholderFor(asset: {
    blurhash?: string | null;
    width?: number | null;
    height?: number | null;
  }): string {
    return (
      this.placeholderDataUri(asset.blurhash, asset.width, asset.height) ??
      this.createPlaceholderSvg(asset.width || 800, asset.height || 600)
    );
  }

  /**
   * Generates an inline SVG data URI from an asset's dimensions and a flat colour: the placeholder of an asset with no
   * BlurHash.
   */
  static createPlaceholderSvg(width = 800, height = 600, accentColor = "#1e293b"): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${accentColor}" />
      <filter id="b" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="20" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" />
      </filter>
      <rect width="${width}" height="${height}" fill="${accentColor}" opacity="0.8" filter="url(#b)" />
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
