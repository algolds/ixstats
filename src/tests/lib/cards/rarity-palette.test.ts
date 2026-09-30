/** Plan 345 Step 5: pins the canonical card-rarity palette in `~/lib/cards/display-utils`. */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect } from "@jest/globals";

jest.mock("~/lib/country-geo", () => ({ computeSpecialStats: jest.fn() }));

import {
  getRarityConfig,
  getRarityHex,
  getRarityTheme,
  getRarityTier,
  normalizeRarity,
} from "~/lib/cards/display-utils";

const PALETTE = [
  ["COMMON", "text-slate-400", "148,163,184", "#94a3b8", 1],
  ["UNCOMMON", "text-emerald-400", "16,185,129", "#10b981", 2],
  ["RARE", "text-blue-400", "59,130,246", "#3b82f6", 3],
  ["ULTRA_RARE", "text-cyan-400", "6,182,212", "#06b6d4", 4],
  ["EPIC", "text-purple-400", "168,85,247", "#a855f7", 5],
  ["LEGENDARY", "text-amber-400", "234,179,8", "#eab308", 6],
] as const;

describe("card rarity palette (display-utils)", () => {
  it.each(PALETTE)("%s → %s / rgb(%s) / %s / tier %i", (rarity, color, rgb, hex, tier) => {
    expect(getRarityConfig(rarity).color).toBe(color);
    expect(getRarityConfig(rarity).rgb).toBe(rgb);
    expect(getRarityHex(rarity)).toBe(hex);
    expect(getRarityTier(rarity)).toBe(tier);
    expect(getRarityTheme(rarity)).toEqual({
      glow: `rgba(${rgb},0.25)`,
      border: `rgba(${rgb},0.35)`,
      text: color,
      badgeStyle: getRarityConfig(rarity).badgeStyle,
    });
  });

  it("normalizes casing and falls back to COMMON for unknown rarities", () => {
    expect(normalizeRarity("ultra_rare")).toBe("ULTRA_RARE");
    expect(normalizeRarity("bogus")).toBe("COMMON");
    expect(normalizeRarity(null)).toBe("COMMON");
    expect(getRarityHex("bogus")).toBe("#94a3b8");
    expect(getRarityTier("bogus")).toBe(0);
  });
});
