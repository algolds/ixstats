import { describe, it, expect } from "@jest/globals";
import {
  FACTBOOK_SECTIONS,
  isFactbookSection,
  sectionFromPathname,
  factbookSectionHref,
  hashToFactbookRoute,
} from "~/lib/country/factbook-routes";

describe("Factbook Routing Utilities", () => {
  it("defines exactly 5 canonical factbook sections", () => {
    expect(FACTBOOK_SECTIONS).toEqual(["overview", "economy", "labor", "government", "geography"]);
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
    expect(sectionFromPathname("/countries/acme")).toBe("overview");
    expect(sectionFromPathname("/other/path")).toBe("overview");
  });

  it("constructs canonical factbook URLs (the overview is the country's own URL)", () => {
    expect(factbookSectionHref("overview", "acme")).toBe("/countries/acme");
    expect(factbookSectionHref("economy", "acme")).toBe("/countries/acme/factbook/economy");
    expect(factbookSectionHref("labor", "acme")).toBe("/countries/acme/factbook/labor");
  });

  it("maps legacy hash fragments to nested routes", () => {
    expect(hashToFactbookRoute("#overview")).toBe("");
    expect(hashToFactbookRoute("#economy")).toBe("/factbook/economy");
    expect(hashToFactbookRoute("#dossier")).toBe("/dossier");
    expect(hashToFactbookRoute("#activity")).toBe("/activity");
    expect(hashToFactbookRoute("#unknown")).toBe("");
  });
});
