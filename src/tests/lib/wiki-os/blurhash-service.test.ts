/**
 * blurhash-service.test.ts — Unit tests for WikiOS BlurHash & LQIP Service
 */

import { describe, it, expect } from "@jest/globals";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";

/** A deterministic noisy RGBA picture (the vectors below were produced by the reference `blurhash` package from it). */
function noise(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  let s = width * height;
  for (let i = 0; i < pixels.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    pixels[i] = i % 4 === 3 ? 255 : (s >> 8) & 255;
  }
  return pixels;
}

function solid(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) pixels.set([...rgb, 255], p * 4);
  return pixels;
}

describe("BlurHashService Engine", () => {
  it("encodes and decodes base-83 numbers deterministically", () => {
    const encoded = BlurHashService.encode83(42, 2);
    expect(encoded).toBeDefined();
    expect(encoded.length).toBe(2);

    const decoded = BlurHashService.decode83(encoded);
    expect(decoded).toBe(42);
  });

  it("generates valid inline SVG placeholders with custom dimensions", () => {
    const svgData = BlurHashService.createPlaceholderSvg(1200, 800, "#0ea5e9");
    expect(svgData.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(svgData).toContain("viewBox%3D%220%200%201200%20800%22");
    expect(svgData).toContain("%230ea5e9");
  });
});

describe("BlurHashService.encode (WK-17)", () => {
  it("gives the reference package's hashes for the same pixels", () => {
    expect(BlurHashService.encode(noise(32, 20), 32, 20, 4, 3)).toBe(
      "L5HV6n?$hy.loP%d:[zW+1RfM|9%"
    );
    expect(BlurHashService.encode(noise(5, 9), 5, 9, 3, 4)).toBe("TYIE,[.QG$=O#SxU+jjcnT}uTGTC");
    expect(BlurHashService.encode(noise(4, 4), 4, 4, 1, 1)).toBe("00EX36");
  });

  it("is as long as its components say", () => {
    const hash = BlurHashService.encode(noise(16, 12), 16, 12, 4, 3);
    expect(hash).toHaveLength(4 + 2 * 4 * 3);
    expect(BlurHashService.components(hash)).toEqual({ x: 4, y: 3 });
  });

  it("refuses components outside 1 to 9 and pixels that do not match the size", () => {
    expect(() => BlurHashService.encode(noise(4, 4), 4, 4, 0, 3)).toThrow(/components/);
    expect(() => BlurHashService.encode(noise(4, 4), 4, 4, 4, 10)).toThrow(/components/);
    expect(() => BlurHashService.encode(noise(4, 4), 5, 4, 4, 3)).toThrow(/pixels/);
  });
});

describe("BlurHashService.decode (WK-17)", () => {
  it("gives the reference package's pixels", () => {
    expect(Array.from(BlurHashService.decode("LEHV6nWB2yk8pyo0adR*.7kCMdnj", 4, 3)!)).toEqual([
      135, 164, 177, 255, 161, 173, 177, 255, 181, 180, 171, 255, 160, 172, 174, 255, 124, 154, 169,
      255, 148, 148, 154, 255, 164, 145, 134, 255, 146, 152, 155, 255, 124, 144, 154, 255, 144, 134,
      132, 255, 163, 130, 104, 255, 148, 140, 134, 255,
    ]);
  });

  it("round-trips a flat colour (its average, the DC component)", () => {
    const hash = BlurHashService.encode(solid(8, 6, [200, 40, 90]), 8, 6, 1, 1);
    const pixels = BlurHashService.decode(hash, 3, 2)!;
    for (let p = 0; p < 6; p++) {
      expect(Array.from(pixels.slice(p * 4, p * 4 + 4))).toEqual([200, 40, 90, 255]);
    }
  });

  it("returns null for anything that is not a BlurHash", () => {
    expect(BlurHashService.decode("", 4, 3)).toBeNull();
    expect(BlurHashService.decode("LEHV6nWB2yk8pyo0adR*.7kCMdn", 4, 3)).toBeNull(); // one short
    expect(BlurHashService.decode("LEHV6nWB2yk8pyo0adR*.7kCMdéj", 4, 3)).toBeNull(); // not base 83
    expect(BlurHashService.isValid(null)).toBe(false);
    expect(BlurHashService.isValid("LEHV6nWB2yk8pyo0adR*.7kCMdnj")).toBe(true);
  });
});

describe("BlurHashService placeholders (WK-17)", () => {
  const hash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

  it("draws a BlurHash as a small blurred SVG in the file's shape", () => {
    const uri = BlurHashService.placeholderDataUri(hash, 1600, 400)!;
    expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml;utf8,".length));
    expect(svg).toContain('viewBox="0 0 8 2"');
    expect(svg.match(/<rect /g)).toHaveLength(16);
    expect(svg).toContain("feGaussianBlur");
    // Portrait: 8 cells high
    const tall = decodeURIComponent(BlurHashService.placeholderDataUri(hash, 300, 600)!);
    expect(tall).toContain('viewBox="0 0 4 8"');
  });

  it("has no BlurHash placeholder without a valid hash", () => {
    expect(BlurHashService.placeholderDataUri(null, 100, 100)).toBeNull();
    expect(BlurHashService.placeholderDataUri("nonsense", 100, 100)).toBeNull();
  });

  it("falls back to the size-only box when an asset has no hash", () => {
    expect(BlurHashService.placeholderFor({ blurhash: hash, width: 40, height: 30 })).toBe(
      BlurHashService.placeholderDataUri(hash, 40, 30)
    );
    expect(BlurHashService.placeholderFor({ blurhash: null, width: 40, height: 30 })).toBe(
      BlurHashService.createPlaceholderSvg(40, 30)
    );
  });
});
