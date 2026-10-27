/** The country document's addresses: tabs, sheets and the homes of the old routes. */
import {
  countrySheetHref,
  countryTabHref,
  countryTabOf,
  legacyCountryRedirect,
  parseSheet,
} from "~/lib/country/country-routes";

describe("country tabs", () => {
  it("puts the Factbook at the country's own URL and the rest under it", () => {
    expect(countryTabHref("factbook", "caphiria")).toBe("/countries/caphiria");
    expect(countryTabHref("map", "caphiria")).toBe("/countries/caphiria/map");
    expect(countryTabHref("lore", "caphiria")).toBe("/countries/caphiria/lore");
    expect(countryTabHref("history", "caphiria")).toBe("/countries/caphiria/history");
  });

  it("reads the tab from a pathname, with or without the base path or a trailing slash", () => {
    expect(countryTabOf("/countries/caphiria")).toBe("factbook");
    expect(countryTabOf("/projects/ixstates/countries/caphiria/map")).toBe("map");
    expect(countryTabOf("/countries/caphiria/history/")).toBe("history");
    expect(countryTabOf("/countries/caphiria/whatever")).toBe("factbook");
  });
});

describe("sheets", () => {
  it("builds sheet links, with the Labor segment only when asked", () => {
    expect(countrySheetHref("caphiria", "state")).toBe("/countries/caphiria?sheet=state");
    expect(countrySheetHref("caphiria", "economy", "labor")).toBe(
      "/countries/caphiria?sheet=economy&segment=labor"
    );
  });

  it("parses a sheet, defaulting the segment to economy and rejecting unknown sheets", () => {
    expect(parseSheet(new URLSearchParams("sheet=economy&segment=labor"))).toEqual({
      sheet: "economy",
      segment: "labor",
    });
    expect(parseSheet(new URLSearchParams("sheet=foreign"))).toEqual({
      sheet: "foreign",
      segment: "economy",
    });
    expect(parseSheet(new URLSearchParams("sheet=bogus"))).toBeNull();
    expect(parseSheet(null)).toBeNull();
  });
});

describe("legacyCountryRedirect", () => {
  it.each([
    [["activity"], "/countries/x/history"],
    [["dossier"], "/countries/x/lore"],
    [["factbook"], "/countries/x?sheet=economy"],
    [["factbook", "economy"], "/countries/x?sheet=economy"],
    [["factbook", "labor"], "/countries/x?sheet=economy&segment=labor"],
    [["factbook", "government"], "/countries/x?sheet=state"],
    [["factbook", "geography"], "/countries/x/map"],
  ])("sends %j to %s", (rest, href) => {
    expect(legacyCountryRedirect("x", rest)).toBe(href);
  });
});
