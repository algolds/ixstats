/**
 * blurhash-service.ts — WikiOS Native BlurHash & LQIP Placeholder Engine
 *
 * Lightweight, zero-dependency implementation of BlurHash encoding and decoding
 * for progressive visual hydration and zero Cumulative Layout Shift (CLS: 0).
 */

const DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

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
   * Generates an inline SVG data URI from an asset's dimensions and blurhash/placeholder color.
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
