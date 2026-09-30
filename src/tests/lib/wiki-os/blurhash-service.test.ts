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

  it("generates deterministic compact BlurHash strings from asset names", () => {
    const hash1 = BlurHashService.generateDeterministicHash("Coat_of_arms_of_Oakhaven.svg");
    const hash2 = BlurHashService.generateDeterministicHash("Coat_of_arms_of_Oakhaven.svg");
    const hash3 = BlurHashService.generateDeterministicHash("Flag_of_Kuthernburg.png");

    expect(hash1).toBeDefined();
    expect(hash1.length).toBeGreaterThan(10);
    expect(hash1).toBe(hash2); // Deterministic parity
    expect(hash1).not.toBe(hash3); // Uniqueness across seeds
  });

  it("generates valid inline SVG placeholders with custom dimensions", () => {
    const svgData = BlurHashService.createPlaceholderSvg(1200, 800, "#0ea5e9");
    expect(svgData.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(svgData).toContain("viewBox%3D%220%200%201200%20800%22");
    expect(svgData).toContain("%230ea5e9");
  });
});
