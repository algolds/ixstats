/** @jest-environment node */
/**
 * Cards refresh Phase 3 (spec §2.3 Deleted): one face, back, sheet and reveal, and one rarity palette. The old
 * renderers, palettes, pack cinematic, collection pages and lore generator stay gone.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

const GONE = [
  "src/components/cards/display/CardDisplay.tsx",
  "src/components/cards/display/CardBack.tsx",
  "src/components/cards/display/Card3DViewer.tsx",
  "src/components/cards/display/CardDetailsModal.tsx",
  "src/components/cards/display/CardHolographicCover.tsx",
  "src/components/cards/display/LoreCardHolographicCover.tsx",
  "src/components/cards/display/HolographicOverlay.tsx",
  "src/components/cards/display/RarityBadge.tsx",
  "src/components/cards/display/holo-helpers.ts",
  "src/components/cards/display/modal",
  "src/components/cards/icons",
  "src/components/cards/pack-opening/PackOpeningSequence.tsx",
  "src/components/cards/pack-opening/GlassSplashEffect.tsx",
  "src/components/cards/collections",
  "src/components/cards/lore",
  "src/components/vault/collections",
  "src/components/vault/sections/VaultCardsSection.tsx",
  "src/components/vault/sections/VaultMarketplaceSection.tsx",
  "src/components/ui/comet-card.tsx",
  "src/lib/cards/rarity-materials.ts",
  "src/lib/cards/card-metadata-resolver.ts",
  "src/lib/cards/pack-opening-service.ts",
  "src/server/api/routers/vault/collections.ts",
  "src/server/api/routers/cards/collections.ts",
];

/** Names of the old palettes and renderers; none may come back under another file. */
const BANNED =
  /\b(RARITY_COLORS|RARITY_THEMES|RARITY_MATERIALS|getRarityTheme|getRarityGlow|getRarityConfig|getRarityHex|getRarityTier|getCardTypeLabel|CardDisplay|CardDetailsModal|Card3DViewer|CardHolographicCover|HolographicOverlay|RarityBadge|PackOpeningSequence|GlassSplashEffect|CometCard)\b/;

/** The rarity palette: the Facet tokens, the face's sheet, and their TypeScript mirror (CARD_RARITY_HEX). */
const PALETTE = [
  "src/styles/facet/tokens.css",
  "src/styles/card-art.css",
  "src/lib/design/tokens.ts",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === join(SRC, "tests") ? [] : walk(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

const sources = walk(SRC).map((file) => ({
  file: relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));

describe("cards face and hub removals", () => {
  it.each(GONE)("%s is gone", (path) => {
    expect(existsSync(join(ROOT, path))).toBe(false);
  });

  it("names no old renderer or palette anywhere in src", () => {
    expect(sources.filter(({ text }) => BANNED.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("keeps the rarity colours in the one palette", () => {
    const outside = sources
      .filter(({ file, text }) => /--color-rarity-/.test(text) && !PALETTE.includes(file))
      .map(({ file }) => file);
    expect(outside).toEqual([]);
  });
});
