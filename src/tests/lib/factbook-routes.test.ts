/**
 * Tests for factbook-routes.ts — the country-profile navigation config.
 *
 * Covers the Tier-2 section list, pathname→section resolution, section href
 * generation, and the legacy URL-hash deep-link mapping.
 */

import {
  FACTBOOK_SECTIONS,
  factbookSectionHref,
  hashToFactbookRoute,
  isFactbookSection,
  legacyHashRoute,
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

  describe("hashToFactbookRoute", () => {
    it("maps legacy tab hashes onto their nested routes", () => {
      expect(hashToFactbookRoute("#economy")).toBe("/factbook/economy");
      expect(hashToFactbookRoute("#labor")).toBe("/factbook/labor");
      expect(hashToFactbookRoute("#government")).toBe("/factbook/government");
      expect(hashToFactbookRoute("#geography")).toBe("/factbook/geography");
      expect(hashToFactbookRoute("#overview")).toBe("");
      expect(hashToFactbookRoute("#dossier")).toBe("/dossier");
      expect(hashToFactbookRoute("#activity")).toBe("/activity");
    });

    it("defaults legacy v2 drill kinds to the Factbook overview", () => {
      expect(hashToFactbookRoute("#relations")).toBe("");
      expect(hashToFactbookRoute("#defense")).toBe("");
      expect(hashToFactbookRoute("#politics")).toBe("");
    });

    it("defaults unknown and empty hashes to the Factbook overview (the country's own URL)", () => {
      expect(hashToFactbookRoute("")).toBe("");
      expect(hashToFactbookRoute("#")).toBe("");
      expect(hashToFactbookRoute("#nonsense")).toBe("");
      expect(hashToFactbookRoute("#Economy")).toBe("/factbook/economy");
    });
  });

  describe("legacyHashRoute", () => {
    it("redirects only known legacy tab hashes from the bare country URL", () => {
      expect(legacyHashRoute("#economy")).toBe("/factbook/economy");
      expect(legacyHashRoute("#dossier")).toBe("/dossier");
      expect(legacyHashRoute("#Activity")).toBe("/activity");
    });

    it("keeps the Factbook overview in place for hashes that belong on it", () => {
      expect(legacyHashRoute("#overview")).toBeNull();
      expect(legacyHashRoute("#relations")).toBeNull();
      expect(legacyHashRoute("#defense")).toBeNull();
      expect(legacyHashRoute("#politics")).toBeNull();
    });

    it("keeps the Factbook overview in place for an empty or unknown hash", () => {
      expect(legacyHashRoute("")).toBeNull();
      expect(legacyHashRoute("#")).toBeNull();
      expect(legacyHashRoute("#command-economy")).toBeNull();
      expect(legacyHashRoute("#constructor")).toBeNull();
    });
  });
});
