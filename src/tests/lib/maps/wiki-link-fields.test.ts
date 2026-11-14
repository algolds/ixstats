import {
  normalizeFeatureWikiCreate,
  normalizeFeatureWikiUpdate,
} from "~/lib/maps/wiki-link-fields";

const mockGetArticleIntro = jest.fn();
const mockGetPageImages = jest.fn();
const mockGetCoordinates = jest.fn();
const mockGetPageSections = jest.fn();

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleIntro: (...args: [string, string?]) => mockGetArticleIntro(...args),
  getPageImages: (...args: [string, Record<string, object | number | string>?]) =>
    mockGetPageImages(...args),
  getCoordinates: (...args: [string, string?]) => mockGetCoordinates(...args),
  getPageSections: (...args: [string, string?]) => mockGetPageSections(...args),
}));

import { enrichFromWiki } from "~/lib/maps/story-pin-enrichment";

describe("normalizeFeatureWikiCreate & normalizeFeatureWikiUpdate", () => {
  it("stamps wikiSource on create when wikiPageTitle is present and omits both when absent", () => {
    expect(normalizeFeatureWikiCreate({})).toEqual({});
    expect(normalizeFeatureWikiCreate({ wikiPageTitle: "Caphiria" })).toEqual({
      wikiPageTitle: "Caphiria",
      wikiSource: "ixwiki",
    });
    expect(normalizeFeatureWikiCreate({ wikiPageTitle: "Lucrecia", wikiSource: "iiwiki" })).toEqual(
      {
        wikiPageTitle: "Lucrecia",
        wikiSource: "iiwiki",
      }
    );
  });

  it("clears wikiSource when unlinking and preserves stored source on unchanged title", () => {
    expect(
      normalizeFeatureWikiUpdate({}, { wikiPageTitle: "Lucrecia", wikiSource: "iiwiki" })
    ).toEqual({});
    expect(
      normalizeFeatureWikiUpdate(
        { wikiPageTitle: null },
        { wikiPageTitle: "Lucrecia", wikiSource: "iiwiki" }
      )
    ).toEqual({
      wikiPageTitle: null,
      wikiSource: null,
    });
    expect(
      normalizeFeatureWikiUpdate(
        { wikiPageTitle: "Lucrecia" },
        { wikiPageTitle: "Lucrecia", wikiSource: "iiwiki" }
      )
    ).toEqual({
      wikiPageTitle: "Lucrecia",
      wikiSource: "iiwiki",
    });
    expect(
      normalizeFeatureWikiUpdate(
        { wikiPageTitle: "New Article", wikiSource: "iiwiki" },
        { wikiPageTitle: "Old Article", wikiSource: "ixwiki" }
      )
    ).toEqual({
      wikiPageTitle: "New Article",
      wikiSource: "iiwiki",
    });
  });
});

describe("enrichFromWiki sister-wiki support", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enriches from IIWiki and returns an IIWiki reader URL when wikiSource is iiwiki", async () => {
    mockGetArticleIntro.mockResolvedValue({ title: "Battle of Lucrecia", text: "Decisive siege." });
    mockGetPageImages.mockResolvedValue([]);
    mockGetCoordinates.mockResolvedValue([12.5, 41.9]);
    mockGetPageSections.mockResolvedValue([{ title: "Aftermath" }]);

    const res = await enrichFromWiki("Battle of Lucrecia", "iiwiki");

    expect(mockGetArticleIntro).toHaveBeenCalledWith("Battle of Lucrecia", "iiwiki");
    expect(mockGetPageImages).toHaveBeenCalledWith(
      "Battle of Lucrecia",
      expect.objectContaining({ wiki: "iiwiki" })
    );
    expect(mockGetCoordinates).toHaveBeenCalledWith("Battle of Lucrecia", "iiwiki");
    expect(mockGetPageSections).toHaveBeenCalledWith("Battle of Lucrecia", "iiwiki");
    expect(res).toMatchObject({
      intro: "Decisive siege.",
      coordinates: { lat: 12.5, lng: 41.9 },
      sections: ["Aftermath"],
      wikiUrl: "/wiki/Battle_of_Lucrecia?source=iiwiki",
    });
  });
});
