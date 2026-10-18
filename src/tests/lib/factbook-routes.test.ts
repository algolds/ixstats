/**
 * Tests for factbook-routes.ts — the country-profile navigation config.
 *
 * Covers the Tier-2 section list, pathname→section resolution and section href
 * generation.
 */

import {
  FACTBOOK_SECTIONS,
  factbookSectionHref,
  isFactbookSection,
  sectionFromPathname,
} from "~/lib/country/factbook-routes";

describe("factbook-routes", () => {
  describe("FACTBOOK_SECTIONS", () => {
    it("exposes exactly the five Tier-2 sections in order", () => {
      expect(FACTBOOK_SECTIONS).toEqual([
        "overview",
        "economy",
        "labor",
        "government",
        "geography",
      ]);
    });

    it("isFactbookSection accepts only valid sections", () => {
      expect(isFactbookSection("overview")).toBe(true);
      expect(isFactbookSection("labor")).toBe(true);
      expect(isFactbookSection("dossier")).toBe(false);
      expect(isFactbookSection("")).toBe(false);
      expect(isFactbookSection("Economy")).toBe(false);
    });
  });

  describe("sectionFromPathname", () => {
    it("resolves the active section from a nested factbook path", () => {
      expect(sectionFromPathname("/countries/acme/factbook/economy")).toBe("economy");
      expect(sectionFromPathname("/countries/acme/factbook/labor")).toBe("labor");
      expect(sectionFromPathname("/countries/acme/factbook/government")).toBe("government");
      expect(sectionFromPathname("/countries/acme/factbook/geography")).toBe("geography");
    });

    it("defaults to overview for the bare factbook route", () => {
      expect(sectionFromPathname("/countries/acme/factbook")).toBe("overview");
      expect(sectionFromPathname("/countries/acme/factbook/")).toBe("overview");
    });

    it("defaults to overview for unknown or missing segments", () => {
      expect(sectionFromPathname("/countries/acme/factbook/whatever")).toBe("overview");
      expect(sectionFromPathname("/countries/acme")).toBe("overview");
      expect(sectionFromPathname("")).toBe("overview");
    });
  });

  describe("factbookSectionHref", () => {
    it("generates the canonical route per section", () => {
      expect(factbookSectionHref("overview", "acme")).toBe("/countries/acme");
      expect(factbookSectionHref("economy", "acme")).toBe("/countries/acme/factbook/economy");
      expect(factbookSectionHref("labor", "acme")).toBe("/countries/acme/factbook/labor");
      expect(factbookSectionHref("government", "acme")).toBe("/countries/acme/factbook/government");
      expect(factbookSectionHref("geography", "acme")).toBe("/countries/acme/factbook/geography");
    });
  });
});
