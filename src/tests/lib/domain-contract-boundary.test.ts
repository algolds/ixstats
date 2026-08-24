import { describe, it, expect } from "@jest/globals";
import { checkServerBoundary } from "../../../scripts/audit/audit-arch";
import {
  ATOMIC_TAX_COMPONENTS,
  calculateTotalTaxEffectiveness,
  TAX_COMPONENT_CATEGORIES,
} from "~/lib/government/tax/atomic-tax-components";
import { modernArchetypes } from "~/lib/economy/archetypes/modern";
import { historicalArchetypes } from "~/lib/economy/archetypes/historical";
import {
  enhancedArchetypes,
  archetypeCategories,
  validateArchetypeSelection,
} from "~/lib/archetypes/catalog";
import { extractDataFromWikiSections } from "~/lib/builder/wiki-data-extractor";

describe("Plan 161: Domain Contract Boundary", () => {
  describe("Architecture Guard Check", () => {
    it("verifies zero forbidden server imports from ~/app, ~/components, or ~/hooks", () => {
      const errors = checkServerBoundary();
      expect(errors).toEqual([]);
    });
  });

  describe("Atomic Tax Components Contract", () => {
    it("exports atomic tax components across 5 categories", () => {
      expect(Object.keys(ATOMIC_TAX_COMPONENTS).length).toBeGreaterThanOrEqual(40);
      expect(Object.keys(TAX_COMPONENT_CATEGORIES).length).toBe(5);
    });

    it("correctly computes tax effectiveness metrics for selected component IDs", () => {
      const metrics = calculateTotalTaxEffectiveness([
        "digital_filing",
        "progressive_tax",
        "audit_system",
      ]);
      expect(metrics.totalEffectiveness).toBeGreaterThan(0);
      expect(metrics.totalEffectiveness).toBeLessThanOrEqual(100);
    });
  });

  describe("Economic Archetypes Fallback Catalog", () => {
    it("exports modern and historical archetype Maps with valid metadata", () => {
      expect(modernArchetypes.size).toBe(10);
      expect(historicalArchetypes.size).toBe(10);

      const siliconValley = modernArchetypes.get("silicon-valley");
      expect(siliconValley).toBeDefined();
      expect(siliconValley?.name).toBe("Silicon Valley Model");
      expect(siliconValley?.economicComponents.length).toBeGreaterThan(0);

      const britishEmpire = historicalArchetypes.get("british-empire");
      expect(britishEmpire).toBeDefined();
      expect(britishEmpire?.name).toBe("British Empire Model");
    });
  });

  describe("Selectable Archetypes Catalog & Validator", () => {
    it("contains 14 archetypes across 5 categories and validates selections", () => {
      expect(enhancedArchetypes.length).toBe(14);
      expect(archetypeCategories.length).toBe(5);

      // Valid selection
      expect(
        validateArchetypeSelection(["economic-powerhouse", "democratic-stable"])
      ).toBe(true);

      // Exceeds total selections (limit is 5)
      expect(
        validateArchetypeSelection([
          "economic-powerhouse",
          "developing-giant",
          "resource-rich",
          "service-economy",
          "democratic-stable",
          "federal-system",
        ])
      ).toBe(false);

      // Exceeds category limit (economic category limit is 2)
      expect(
        validateArchetypeSelection([
          "economic-powerhouse",
          "developing-giant",
          "resource-rich",
        ])
      ).toBe(false);
    });
  });

  describe("Wiki Data Extractor", () => {
    it("extracts structured economic and government data from wiki text sections", () => {
      const sections = [
        {
          title: "Economy",
          content:
            "The GDP of the nation is $1.5 trillion with a GDP per capita of $45,000. Major industries include technology, aerospace, and finance.",
        },
        {
          title: "Government and Politics",
          content:
            "The country is a federal republic. The legislature is the National Assembly. Ministry of Finance is led by Jane Doe.",
        },
      ];

      const extracted = extractDataFromWikiSections(sections);
      expect(extracted.economy?.gdpNominal).toBe(1500000000000);
      expect(extracted.economy?.gdpPerCapita).toBe(45000);
      expect(extracted.economy?.majorIndustries).toContain("technology");
      expect(extracted.government?.governmentType).toBe("federal republic");
      expect(extracted.government?.legislature).toBe("National Assembly");
    });
  });
});
