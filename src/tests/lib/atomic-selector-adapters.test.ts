import {
  getNormalizedTaxComponents,
  getNormalizedTaxCategories,
  calculateTaxMetrics,
  evaluateTaxSynergy,
  evaluateTaxConflict,
} from "~/components/mycountry/domains/government/tax/atoms/tax-selector-adapter";
import {
  getGovernmentComponents,
  getGovernmentCategories,
  calculateGovernmentMetrics,
} from "~/components/mycountry/domains/government/atoms/government-selector-adapter";
import {
  getEconomicComponents,
  getEconomicCategories,
  getEconomicTemplates,
  calculateEconomicDomainMetrics,
} from "~/components/mycountry/domains/economy/atoms/economic-selector-adapter";

describe("Atomic Selector Adapters (Plan 166)", () => {
  describe("Tax Selector Adapter", () => {
    test("returns normalized tax components and categories", () => {
      const components = getNormalizedTaxComponents();
      const categories = getNormalizedTaxCategories();

      expect(Object.keys(components).length).toBeGreaterThan(0);
      expect(Object.keys(categories).length).toBeGreaterThan(0);
      expect(components["progressive_income_tax"]).toBeDefined();
    });

    test("delegates tax calculations and checks correctly", () => {
      const metrics = calculateTaxMetrics(["progressive_income_tax"]);
      expect(metrics.totalEffectiveness).toBeGreaterThan(0);

      const synergy = evaluateTaxSynergy("progressive_income_tax", "wealth_tax");
      expect(typeof synergy).toBe("number");

      const conflict = evaluateTaxConflict("flat_income_tax", "progressive_income_tax");
      expect(typeof conflict).toBe("boolean");
    });
  });

  describe("Government Selector Adapter", () => {
    test("returns government components and categories", () => {
      const components = getGovernmentComponents();
      const categories = getGovernmentCategories();

      expect(Object.keys(components).length).toBeGreaterThan(0);
      expect(categories.length).toBeGreaterThan(0);
    });

    test("delegates government domain metrics calculation", () => {
      const result = calculateGovernmentMetrics([]);
      expect(result.effectiveness.totalEffectiveness).toBe(0);
      expect(result.implementationCost).toBe(0);
      expect(result.maintenanceCost).toBe(0);
      expect(result.synergies).toEqual([]);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("Economic Selector Adapter", () => {
    test("returns economic components, categories, and templates", () => {
      const components = getEconomicComponents();
      const categories = getEconomicCategories();
      const templates = getEconomicTemplates();

      expect(components.length).toBeGreaterThan(0);
      expect(categories.length).toBeGreaterThan(0);
      expect(templates.length).toBeGreaterThan(0);
    });

    test("delegates economic domain calculations", () => {
      const result = calculateEconomicDomainMetrics([]);
      expect(result.metrics.totalCost).toBe(0);
      expect(result.metrics.maintenanceCost).toBe(0);
      expect(result.synergies).toEqual([]);
      expect(result.conflicts).toEqual([]);
    });
  });
});
