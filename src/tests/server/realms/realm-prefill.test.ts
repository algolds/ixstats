/** @jest-environment node */
/**
 * AT-3: a claimed nation page's infobox prefills the nation its approval creates: baseline figures, flag and
 * coat of arms, and national identity. Nonsense values fall back to the baseline; a failing wiki gives nothing.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  getArticleWikitextShadow: jest.fn(),
}));

import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import {
  EMPTY_PREFILL,
  fetchNationPagePrefill,
  prefillFromInfobox,
} from "~/server/modules/realms/realms.prefill";

const fetchArticle = getArticleWikitextShadow as jest.Mock;

describe("prefillFromInfobox", () => {
  it("maps the infobox to the baseline and the national identity", () => {
    const prefill = prefillFromInfobox(
      {
        name: "Aurelia",
        official_name: "Federal Republic of Aurelia",
        capital: "Port Aurel",
        government_type: "Federal republic",
        population: 4_000_000,
        gdp_nominal: 200_000_000_000,
        area_km2: 120_000,
        continent: "Argis",
        currency: "Aurel",
        official_languages: "Aurelian",
        motto: "Ever onward",
        flagUrl: "https://iiwiki.com/images/flag.png",
      },
      "iiwiki"
    );
    expect(prefill.country).toEqual({
      baselinePopulation: 4_000_000,
      baselineGdpPerCapita: 50_000,
      landArea: 120_000,
      continent: "Argis",
      government: "Federal republic",
      flag: "https://iiwiki.com/images/flag.png",
    });
    expect(prefill.identity).toEqual({
      officialName: "Federal Republic of Aurelia",
      governmentType: "Federal republic",
      capitalCity: "Port Aurel",
      motto: "Ever onward",
      currency: "Aurel",
      officialLanguages: "Aurelian",
    });
  });

  it("drops figures that can't be right and blank text", () => {
    const prefill = prefillFromInfobox(
      { name: "X", population: -5, area_km2: Number.NaN, gdpPerCapita: 1e12, capital: "   " },
      "iiwiki"
    );
    expect(prefill).toEqual({ country: {}, identity: {} });
  });

  it("gives nothing without an infobox", () => {
    expect(prefillFromInfobox(null, "iiwiki")).toBe(EMPTY_PREFILL);
  });
});

describe("fetchNationPagePrefill", () => {
  beforeEach(() => fetchArticle.mockReset());

  it("reads the page from its own wiki and parses its infobox", async () => {
    fetchArticle.mockResolvedValue({
      wikitext:
        "{{Infobox country\n| conventional_long_name = Kingdom of Borea\n| capital = Nord\n}}",
    });
    const prefill = await fetchNationPagePrefill("althistory", "Borea");
    expect(fetchArticle).toHaveBeenCalledWith("Borea", "althistory");
    expect(prefill.identity).toMatchObject({
      officialName: "Kingdom of Borea",
      capitalCity: "Nord",
    });
  });

  it("falls back to the baseline when the wiki fails or the page is missing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchArticle.mockRejectedValue(new Error("down"));
    await expect(fetchNationPagePrefill("iiwiki", "Aurelia")).resolves.toBe(EMPTY_PREFILL);
    fetchArticle.mockResolvedValue(null);
    await expect(fetchNationPagePrefill("iiwiki", "Aurelia")).resolves.toBe(EMPTY_PREFILL);
    warn.mockRestore();
  });
});
