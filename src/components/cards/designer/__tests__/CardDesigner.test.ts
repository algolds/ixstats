import { DEFAULT_DESIGN_STATE, RARITY_BASE_VALUES } from "../types";
import { RARITY_MATERIALS, getRarityMaterial } from "~/lib/cards";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

jest.mock("@tsparticles/react", () => ({
  __esModule: true,
  default: () => null,
  ParticlesProvider: ({ children }: any) => children,
}));

jest.mock("@tsparticles/slim", () => ({
  __esModule: true,
  loadSlim: jest.fn(),
}));

jest.mock("~/components/vault/CosmeticParticles", () => ({
  __esModule: true,
  CosmeticParticles: () => null,
  default: () => null,
}));

describe("Card Designer Studio & Game-Icons Library", () => {
  it("should have correct default design state initialized", () => {
    expect(DEFAULT_DESIGN_STATE.title).toBe("Concord of Nations");
    expect(DEFAULT_DESIGN_STATE.rarity).toBe("LEGENDARY");
    expect(DEFAULT_DESIGN_STATE.emblemIcon).not.toBeNull();
    expect(DEFAULT_DESIGN_STATE.emblemIcon?.slug).toBe("laurel-crown");
    expect(DEFAULT_DESIGN_STATE.watermarkIcon).not.toBeNull();
    expect(DEFAULT_DESIGN_STATE.watermarkIcon?.slug).toBe("scroll-unfurled");
    expect(["ixwiki", "iiwiki", "wikios", "stash"]).toContain(DEFAULT_DESIGN_STATE.wikiSource);
  });

  it("should contain standard rarity baseline valuations", () => {
    expect(RARITY_BASE_VALUES.COMMON).toBe(100);
    expect(RARITY_BASE_VALUES.RARE).toBe(600);
    expect(RARITY_BASE_VALUES.EPIC).toBe(2500);
    expect(RARITY_BASE_VALUES.LEGENDARY).toBe(6000);
    expect(RARITY_BASE_VALUES.DIVINE).toBe(50000);
  });

  it("should have generated game-icons manifest with >4,000 icons", () => {
    const manifestPath = join(process.cwd(), "public/icons/game-icons-manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const data = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(4000);

    const first = data[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("slug");
    expect(first).toHaveProperty("author");
    expect(first).toHaveProperty("path");
    expect(first).toHaveProperty("tags");
  });

  it("should have 8 distinct physical material profiles with custom shaders", () => {
    const rarities = [
      "COMMON",
      "UNCOMMON",
      "RARE",
      "ULTRA_RARE",
      "EPIC",
      "LEGENDARY",
      "MYTHIC",
      "DIVINE",
    ];
    rarities.forEach((r) => {
      const mat = getRarityMaterial(r);
      expect(mat).toBeDefined();
      expect(mat.materialName).toBeTruthy();
      expect(mat.description).toBeTruthy();
      expect(mat.glareIntensity).toBeGreaterThan(0);
      expect(mat.borderStyle).toBeTruthy();
    });

    expect(RARITY_MATERIALS.LEGENDARY.materialName).toContain("24K");
    expect(RARITY_MATERIALS.COMMON.particles.enabled).toBe(false);
    expect(RARITY_MATERIALS.DIVINE.particles.enabled).toBe(true);
  });

  it("should have comprehensive synonyms and keywords for all 13 LoreCategory entries", () => {
    const { CATEGORY_SYNONYMS, findMatchingCategory, LoreCategory } = require("~/lib/cards");

    // Check Nations synonyms
    const nationSynonyms = CATEGORY_SYNONYMS[LoreCategory.NATION];
    expect(nationSynonyms).toContain("country");
    expect(nationSynonyms).toContain("countries");
    expect(nationSynonyms).toContain("state");
    expect(nationSynonyms).toContain("kingdom");
    expect(nationSynonyms).toContain("empire");
    expect(nationSynonyms).toContain("republic");

    // Check Military synonyms
    const militarySynonyms = CATEGORY_SYNONYMS[LoreCategory.MILITARY];
    expect(militarySynonyms).toContain("war");
    expect(militarySynonyms).toContain("wars");
    expect(militarySynonyms).toContain("battle");
    expect(militarySynonyms).toContain("army");
    expect(militarySynonyms).toContain("navy");

    // Check Geography synonyms
    const geoSynonyms = CATEGORY_SYNONYMS[LoreCategory.GEOGRAPHY];
    expect(geoSynonyms).toContain("ocean");
    expect(geoSynonyms).toContain("sea");
    expect(geoSynonyms).toContain("mountain");
    expect(geoSynonyms).toContain("river");
    expect(geoSynonyms).toContain("island");

    // Check Religion synonyms
    const relSynonyms = CATEGORY_SYNONYMS[LoreCategory.RELIGION];
    expect(relSynonyms).toContain("church");
    expect(relSynonyms).toContain("faith");
    expect(relSynonyms).toContain("cult");
    expect(relSynonyms).toContain("temple");

    // Check People / Monarchs synonyms
    const peopleSynonyms = CATEGORY_SYNONYMS[LoreCategory.PEOPLE];
    expect(peopleSynonyms).toContain("monarch");
    expect(peopleSynonyms).toContain("king");
    expect(peopleSynonyms).toContain("emperor");
    expect(peopleSynonyms).toContain("leader");

    // Check Diplomacy synonyms
    const dipSynonyms = CATEGORY_SYNONYMS[LoreCategory.DIPLOMACY];
    expect(dipSynonyms).toContain("treaty");
    expect(dipSynonyms).toContain("accord");
    expect(dipSynonyms).toContain("alliance");

    // Check matching helper
    expect(findMatchingCategory("country")).toBe(LoreCategory.NATION);
    expect(findMatchingCategory("battles")).toBe(LoreCategory.MILITARY);
    expect(findMatchingCategory("cathedrals")).toBe(LoreCategory.RELIGION);
    expect(findMatchingCategory("parliaments")).toBe(LoreCategory.GOVERNMENT);
    expect(findMatchingCategory("unknown_keyword_xyz")).toBeNull();
  });

  it("should have IXWB preset and category / namespace 0 crawlers configured", () => {
    const { CATEGORY_PRESETS } = require("~/app/admin/cards/LoreCardBatchAdmin");
    const { wikiLoreCardGenerator } = require("~/lib/wiki/lore-card-generator");

    // Check IXWB preset
    const ixwbPreset = CATEGORY_PRESETS.find((p: any) => p.categoryName === "IXWB");
    expect(ixwbPreset).toBeDefined();
    expect(ixwbPreset.name).toBe("IXWB Worldbuilding");
    expect(ixwbPreset.wikiSourceFilter).toBe("ixwiki");
    expect(ixwbPreset.terms.length).toBeGreaterThanOrEqual(10);
    expect(ixwbPreset.synonyms).toContain("ixwb");

    // Check methods on wikiLoreCardGenerator
    expect(typeof wikiLoreCardGenerator.searchCategories).toBe("function");
    expect(typeof wikiLoreCardGenerator.fetchCategoryMembers).toBe("function");
    expect(typeof wikiLoreCardGenerator.getCategoriesInfo).toBe("function");
    expect(typeof wikiLoreCardGenerator.fetchAllMainNamespacePages).toBe("function");
  });

  it("should have getSyncLogCards and getSyncLogs configured on nsImportSyncRouter", () => {
    const { nsImportSyncRouter } = require("~/server/api/routers/ns-import/sync");
    expect(nsImportSyncRouter._def.procedures.getSyncLogs).toBeDefined();
    expect(nsImportSyncRouter._def.procedures.getSyncLogCards).toBeDefined();
    expect(nsImportSyncRouter._def.procedures.getSyncHealth).toBeDefined();
  });
});
