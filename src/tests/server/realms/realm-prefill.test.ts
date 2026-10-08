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
import { parseInfoboxWithTemplates } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
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

  it("keeps a sister wiki's flag and coat of arms as this app's media proxy paths", () => {
    const prefill = prefillFromInfobox(
      { name: "Aurelia", image_flag: "Flag of Aurelia.svg", image_coat: "Aurelia arms.png" },
      "iiwiki"
    );
    expect(prefill.country).toEqual({
      flag: "/api/mediawiki/iiwiki/wiki/Special:FilePath/Flag_of_Aurelia.svg",
      coatOfArms: "/api/mediawiki/iiwiki/wiki/Special:FilePath/Aurelia_arms.png",
    });
  });

  it("drops an image value that is neither https nor the app's media proxy", () => {
    for (const flagUrl of [
      "javascript:alert(1)",
      "http://iiwiki.com/flag.png",
      "/somewhere/else.png",
      "/api/mediawiki/../admin",
    ]) {
      expect(prefillFromInfobox({ name: "X", flagUrl }, "iiwiki").country.flag).toBeUndefined();
    }
  });

  it("names the head of state as the leader", () => {
    expect(
      prefillFromInfobox({ name: "X", head_of_state: "Queen Mara II" }, "iiwiki").country
    ).toEqual({ leader: "Queen Mara II" });
    expect(
      prefillFromInfobox({ name: "X", leader_name1: "Chancellor Vey" }, "iiwiki").country
    ).toEqual({ leader: "Chancellor Vey" });
  });

  it("rejects a GDP per capita below the plausibility floor, given or computed", () => {
    expect(prefillFromInfobox({ name: "X", gdpPerCapita: 2 }, "iiwiki").country).toEqual({});
    const computed = prefillFromInfobox(
      { name: "X", population: 30_000_000, gdp_nominal: 1_500 },
      "iiwiki"
    );
    expect(computed.country).toEqual({ baselinePopulation: 30_000_000 });
  });

  it("founds the economy a page's money-formatted infobox gives", () => {
    const data = parseInfoboxWithTemplates(
      "{{Infobox country\n| population_estimate = 30,000,000\n| GDP_nominal = $1.5 trillion\n}}",
      "Aurelia"
    );
    expect(prefillFromInfobox(data, "iiwiki").country).toMatchObject({
      baselinePopulation: 30_000_000,
      baselineGdpPerCapita: 50_000,
    });
  });

  it("gives nothing without an infobox", () => {
    expect(prefillFromInfobox(null, "iiwiki")).toBe(EMPTY_PREFILL);
  });
});

describe("infobox image fields (real IIWiki shapes)", () => {
  it("fills {{PAGENAME}} with the page's title", () => {
    const data = parseInfoboxWithTemplates(
      "{{Infobox country\n| image_flag = Flag of {{PAGENAME}}.png\n| image_coat = Coat of arms of {{ PAGENAME }}.png\n}}",
      "Yosai"
    );
    expect(data).toMatchObject({
      image_flag: "Flag of Yosai.png",
      image_coat: "Coat of arms of Yosai.png",
    });
  });

  it("ignores a commented-out duplicate field", () => {
    const data = parseInfoboxWithTemplates(
      "{{Infobox country\n|image_flag = Flag Dominion of Kori-Chi (Gallambria).svg\n<!--|image_flag =        Flag of Kōri-Chi.png-->\n|image_coat = Coat of Arms of Kōri-Chi.svg\n<!--|image_coat = Government seal of Kōri-Chi.png\n|symbol_type = Government Seal-->\n}}",
      "Kōri-Chi"
    );
    expect(data).toMatchObject({
      image_flag: "Flag Dominion of Kori-Chi (Gallambria).svg",
      image_coat: "Coat of Arms of Kōri-Chi.svg",
    });
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

  it("follows a redirect once to the page that has the infobox", async () => {
    fetchArticle
      .mockResolvedValueOnce({ wikitext: "#REDIRECT [[Mitō]]" })
      .mockResolvedValueOnce({ wikitext: "{{Infobox country\n| capital = Kaiyō\n}}" });
    const prefill = await fetchNationPagePrefill("iiwiki", "Mito");
    expect(fetchArticle).toHaveBeenNthCalledWith(2, "Mitō", "iiwiki");
    expect(prefill.identity).toMatchObject({ capitalCity: "Kaiyō" });
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
