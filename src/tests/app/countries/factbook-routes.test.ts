import { describe, it, expect } from "@jest/globals";
import {
  FACTBOOK_SECTIONS,
  isFactbookSection,
  sectionFromPathname,
  factbookSectionHref,
  hashToFactbookRoute,
} from "~/lib/country/factbook-routes";
import { calculateVitalityData } from "~/app/countries/[slug]/_utils/countryDataTransformers";

describe("Factbook Routing Utilities", () => {
  it("defines exactly 5 canonical factbook sections", () => {
    expect(FACTBOOK_SECTIONS).toEqual([
      "overview",
      "economy",
      "labor",
      "government",
      "geography",
    ]);
  });

  it("validates factbook section strings", () => {
    expect(isFactbookSection("overview")).toBe(true);
    expect(isFactbookSection("economy")).toBe(true);
    expect(isFactbookSection("labor")).toBe(true);
    expect(isFactbookSection("government")).toBe(true);
    expect(isFactbookSection("geography")).toBe(true);
    expect(isFactbookSection("invalid")).toBe(false);
    expect(isFactbookSection("")).toBe(false);
  });

  it("resolves sections from URL pathnames", () => {
    expect(sectionFromPathname("/countries/acme/factbook")).toBe("overview");
    expect(sectionFromPathname("/countries/acme/factbook/")).toBe("overview");
    expect(sectionFromPathname("/countries/acme/factbook/economy")).toBe("economy");
    expect(sectionFromPathname("/countries/acme/factbook/labor")).toBe("labor");
    expect(sectionFromPathname("/countries/acme/factbook/government")).toBe("government");
    expect(sectionFromPathname("/countries/acme/factbook/geography")).toBe("geography");
    expect(sectionFromPathname("/countries/acme/factbook/unknown")).toBe("overview");
    expect(sectionFromPathname("/other/path")).toBe("overview");
  });

  it("constructs canonical factbook URLs", () => {
    expect(factbookSectionHref("overview", "acme")).toBe("/countries/acme/factbook");
    expect(factbookSectionHref("economy", "acme")).toBe("/countries/acme/factbook/economy");
    expect(factbookSectionHref("labor", "acme")).toBe("/countries/acme/factbook/labor");
  });

  it("maps legacy hash fragments to nested routes", () => {
    expect(hashToFactbookRoute("#overview")).toBe("/factbook");
    expect(hashToFactbookRoute("#economy")).toBe("/factbook/economy");
    expect(hashToFactbookRoute("#dossier")).toBe("/dossier");
    expect(hashToFactbookRoute("#activity")).toBe("/activity");
    expect(hashToFactbookRoute("#unknown")).toBe("/factbook");
  });
});

describe("Country Vitality Calculation", () => {
  it("calculates vitality metrics for high-tier nation", () => {
    const result = calculateVitalityData({
      economicTier: "Extravagant",
      adjustedGdpGrowth: 0.05,
      populationGrowthRate: 0.02,
      populationDensity: 120,
    });

    expect(result.economicVitality).toBeGreaterThanOrEqual(95);
    expect(result.populationWellbeing).toBeGreaterThan(50);
    expect(result.diplomaticStanding).toBe(60);
    expect(result.governmentalEfficiency).toBeCloseTo(76, 0);
  });

  it("calculates vitality metrics with negative growth safely bounded", () => {
    const result = calculateVitalityData({
      economicTier: "Developing",
      adjustedGdpGrowth: -0.1,
      populationGrowthRate: -0.01,
      populationDensity: 800,
    });

    expect(result.economicVitality).toBeGreaterThanOrEqual(0);
    expect(result.economicVitality).toBeLessThanOrEqual(100);
    expect(result.populationWellbeing).toBeGreaterThanOrEqual(0);
  });
});
