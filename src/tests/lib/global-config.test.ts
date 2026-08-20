import { describe, it, expect } from "@jest/globals";
import {
  IX_CONFIG,
  GLOBAL_CONFIG,
  getGlobalConfig,
  CARD_GENERAL_DEFAULTS,
  EXCHANGE_CONFIG_DEFAULTS,
  MAP_LAYER_TYPES,
  DEFAULT_USER_AGENT,
} from "~/lib/config";

describe("Global Developer Configuration Registry (src/lib/config.ts)", () => {
  it("exports identical IX_CONFIG and GLOBAL_CONFIG objects", () => {
    expect(IX_CONFIG).toBe(GLOBAL_CONFIG);
  });

  describe("Platform & Versioning", () => {
    it("exposes platform metadata matching buildVersion", () => {
      expect(IX_CONFIG.platform.appVersion).toBeDefined();
      expect(IX_CONFIG.platform.channel).toBeDefined();
      expect(IX_CONFIG.platform.releaseName).toBeDefined();
      expect(IX_CONFIG.platform.versions).toBeDefined();
      expect(IX_CONFIG.platform.defaultTickMultiplier).toBe(1.0);
    });
  });

  describe("Features & Flags", () => {
    it("exposes all gameplay flags", () => {
      expect(IX_CONFIG.features.flags).toBeDefined();
    });
  });

  describe("Maps & Geospatial", () => {
    it("exposes valid map layer types and elevation zones", () => {
      expect(IX_CONFIG.maps.layerTypes).toEqual(MAP_LAYER_TYPES);
      expect(IX_CONFIG.maps.elevationZones.length).toBeGreaterThan(0);
      expect(IX_CONFIG.maps.defaultCenter).toEqual([0, 20]);
      expect(IX_CONFIG.maps.defaultZoom).toBe(2.5);
      expect(IX_CONFIG.maps.minZoom).toBeLessThan(IX_CONFIG.maps.maxZoom);
    });
  });

  describe("WorldGen UPG v2", () => {
    it("matches canonical procedural generation bounds", () => {
      expect(IX_CONFIG.worldgen.meshResolution).toBe(100000);
      expect(IX_CONFIG.worldgen.lloydIterations).toBe(5);
      expect(IX_CONFIG.worldgen.coastalDampingDistance).toBe(3);
    });
  });

  describe("Cards & Vault", () => {
    it("matches card default settings", () => {
      expect(IX_CONFIG.cards.maxInventoryCards).toBe(CARD_GENERAL_DEFAULTS.maxInventoryCards);
      expect(IX_CONFIG.cards.auctionHouseRakePct).toBe(CARD_GENERAL_DEFAULTS.auctionHouseRakePct);
      expect(IX_CONFIG.cards.dailyFreePacks).toBe(CARD_GENERAL_DEFAULTS.dailyFreePacks);
    });

    it("matches exchange default settings", () => {
      expect(IX_CONFIG.vault.charterFee).toBe(EXCHANGE_CONFIG_DEFAULTS.charterFee);
      expect(IX_CONFIG.vault.convertFee).toBe(EXCHANGE_CONFIG_DEFAULTS.convertFee);
    });
  });

  describe("Sports Engine", () => {
    it("exposes all standard sport presets and default rating vector", () => {
      expect(IX_CONFIG.sports.presets.length).toBeGreaterThan(0);
      expect(IX_CONFIG.sports.availablePresetKeys).toContain("soccer");
      expect(IX_CONFIG.sports.availablePresetKeys).toContain("f1");
      expect(IX_CONFIG.sports.defaultRatingVector.overall).toBe(50);
    });
  });

  describe("Military & Statecraft", () => {
    it("exposes branch configs and readiness thresholds", () => {
      expect(IX_CONFIG.military.branches).toBeDefined();
      expect(IX_CONFIG.military.readinessThresholds.combatReady).toBe(85);
      expect(IX_CONFIG.statecraft.civCapBase).toBe(100);
    });
  });

  describe("National Issues", () => {
    it("exposes issue spawn constraints", () => {
      expect(IX_CONFIG.nationalIssues.maxIssuesPerSession).toBe(3);
      expect(IX_CONFIG.nationalIssues.maxIssuesPerWeek).toBe(5);
      expect(IX_CONFIG.nationalIssues.spawnMode).toBe("probability");
    });
  });

  describe("Wiki & MediaWiki", () => {
    it("enforces default IxStats User-Agent", () => {
      expect(IX_CONFIG.wiki.userAgent).toBe(DEFAULT_USER_AGENT);
      expect(IX_CONFIG.wiki.userAgent).toBe("IxStats-Builder");
    });
  });

  describe("System & Memory Guardrails", () => {
    it("enforces safe dev memory boundaries", () => {
      expect(IX_CONFIG.system.safeHeapBoundMb).toBe(6144);
      expect(IX_CONFIG.system.userLogDirectory).toBe("logs/users");
      expect(IX_CONFIG.system.memory).toBeDefined();
    });
  });

  describe("getGlobalConfig helper", () => {
    it("retrieves a domain config slice with typed accuracy", () => {
      const mapsConfig = getGlobalConfig("maps");
      expect(mapsConfig.defaultZoom).toBe(2.5);

      const cardsConfig = getGlobalConfig("cards");
      expect(cardsConfig.maxInventoryCards).toBe(2500);

      const wikiConfig = getGlobalConfig("wiki");
      expect(wikiConfig.userAgent).toBe("IxStats-Builder");
    });
  });
});
