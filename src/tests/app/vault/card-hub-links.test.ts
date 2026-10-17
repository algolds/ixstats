/** @jest-environment node */
/** The PWA shortcuts and the service worker's precache point at the hub, never at an old card address. */
import { readFileSync } from "node:fs";

const OLD =
  /\/vault\/(inventory|collections|lore-gallery|ns-library|ns-deck|packs|market\b|marketplace|trading|crafting|lore-generator)|\/vault\/store\?tab=/;
const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8")) as {
  description: string;
  start_url: string;
  shortcuts: Array<{
    name: string;
    short_name: string;
    url: string;
    icons: Array<{ src: string }>;
  }>;
};
const sw = readFileSync("public/sw.js", "utf8");

describe("PWA links", () => {
  it("starts on the hub and offers Packs, Cards and Market shortcuts", () => {
    expect(manifest.start_url).toBe("/vault/cards/mine");
    expect(manifest.shortcuts.map((s) => [s.name, s.short_name, s.url, s.icons[0]?.src])).toEqual([
      ["Open packs", "Packs", "/vault/store?view=packs", "/images/icons/pack-shortcut.png"],
      ["Cards", "Cards", "/vault/cards/mine", "/images/icons/inventory-shortcut.png"],
      ["Card market", "Market", "/vault/cards/market", "/images/icons/market-shortcut.png"],
    ]);
    expect(manifest.description).toBe("Collect and trade cards across the realms of IxStates");
    expect(JSON.stringify(manifest)).not.toMatch(OLD);
  });

  it("precaches the hub under a new cache name, so the old precache is dropped", () => {
    expect(sw).toContain('const CACHE_NAME = "ixcards-v2";');
    expect(sw).toMatch(
      /const PRECACHE_ASSETS = \[\s*"\/",\s*"\/vault\/store",\s*"\/vault\/cards\/mine",\s*"\/vault\/cards\/market",\s*"\/offline\.html",\s*\];/
    );
    expect(sw).not.toMatch(OLD);
  });
});
