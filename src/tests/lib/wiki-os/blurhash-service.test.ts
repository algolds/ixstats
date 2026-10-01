/**
 * blurhash-service.test.ts — Unit tests for WikiOS BlurHash & LQIP Service
 */

import { describe, it, expect } from "@jest/globals";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";

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
