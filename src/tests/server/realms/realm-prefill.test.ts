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
  it("rejects a GDP per capita below the plausibility floor, given or computed", () => {
    expect(prefillFromInfobox({ name: "X", gdpPerCapita: 2 }, "iiwiki").country).toEqual({});
    const computed = prefillFromInfobox(
      { name: "X", population: 30_000_000, gdp_nominal: 1_500 },
      "iiwiki"
    );
    expect(computed.country).toEqual({ baselinePopulation: 30_000_000 });
  });
});
describe("fetchNationPagePrefill", () => {
  beforeEach(() => fetchArticle.mockReset());
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
