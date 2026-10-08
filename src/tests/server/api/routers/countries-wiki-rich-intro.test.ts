/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Eurth map port, phase 1: a country's intro is read from its own wiki page when it names one
// (`Country.wikiSource` + `wikiPageTitle`, as realm nations do) and links to that wiki. The name lookup,
// IxWiki first and then iiwiki, is kept for a country without a page reference.
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleIntro: jest.fn(),
  getPageSections: jest.fn(),
  getPageImages: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";

interface CountryPageRow {
  id: string;
  wikiSource: string | null;
  wikiPageTitle: string | null;
}

const findMany = jest.fn<Promise<CountryPageRow[]>, [{ where: { id: { in: string[] } } }]>();

const caller = () =>
  createCallerFactory(createTRPCRouter(wikiProcedures))(
    createMockRouterContext({ auth: null, user: null, db: { country: { findMany } } }) as never
  );

const LEAD =
  "'''Tagmatium''' is a nation on the continent of [[Alharu]], long the seat of an old and storied empire.";

function article(wikitext: string) {
  return { wikitext, revid: null, timestamp: "", fromShadow: true, stale: false };
}

/** The (title, wiki) pairs the wikitext store was asked for, in order. */
const reads = () => jest.mocked(getArticleWikitextShadow).mock.calls.map(([t, w]) => [t, w]);

beforeEach(() => {
  jest.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("countries.getWikiRichIntro", () => {
  it("reads a country's own page on its own wiki and links to that wiki", async () => {
    findMany.mockResolvedValue([
      { id: "c-tag", wikiSource: "iiwiki", wikiPageTitle: "Tagmatine Empire" },
    ]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(article(LEAD));

    const intro = await caller().getWikiRichIntro({ countryName: "Tagmatium", countryId: "c-tag" });

    expect(reads()).toEqual([["Tagmatine Empire", "iiwiki"]]);
    expect(intro?.wikiUrl).toBe("https://iiwiki.com/wiki/Tagmatine_Empire");
    expect(intro?.paragraphs[0]).toContain("Tagmatium");
    // A link in the intro opens that wiki's page in the reader, not IxWiki's page of the same title.
    expect(intro?.paragraphs[0]).toContain('href="/wiki/Alharu?source=iiwiki"');
  });

  it("follows a page reference that is a redirect to the page it names", async () => {
    findMany.mockResolvedValue([{ id: "c-mito", wikiSource: "iiwiki", wikiPageTitle: "Mito" }]);
    jest
      .mocked(getArticleWikitextShadow)
      .mockResolvedValueOnce(article("#REDIRECT [[Mitō]]"))
      .mockResolvedValueOnce(article(LEAD));

    const intro = await caller().getWikiRichIntro({ countryName: "Mito", countryId: "c-mito" });

    expect(reads()).toEqual([
      ["Mito", "iiwiki"],
      ["Mitō", "iiwiki"],
    ]);
    expect(intro?.wikiUrl).toBe(`https://iiwiki.com/wiki/${encodeURIComponent("Mitō")}`);
  });

  it("does not look the name up on other wikis when the referenced page is missing", async () => {
    findMany.mockResolvedValue([
      { id: "c-gone", wikiSource: "iiwiki", wikiPageTitle: "Gone Land" },
    ]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(null);

    const intro = await caller().getWikiRichIntro({
      countryName: "Gone Land",
      countryId: "c-gone",
    });

    expect(intro).toBeNull();
    expect(reads()).toEqual([["Gone Land", "iiwiki"]]);
  });

  it("keeps the name lookup, IxWiki first, for a country without a page reference", async () => {
    jest
      .mocked(getArticleWikitextShadow)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(article(LEAD));

    const intro = await caller().getWikiRichIntro({ countryName: "Elmeria", countryId: "c-elm" });

    expect(findMany.mock.calls[0]?.[0].where.id.in).toEqual(["c-elm"]);
    expect(reads()).toEqual([
      ["Elmeria", "ixwiki"],
      ["Elmeria", "iiwiki"],
    ]);
    expect(intro?.wikiUrl).toBe("https://iiwiki.com/wiki/Elmeria");
  });

  it("links an IxWiki page to the WikiOS reader", async () => {
    findMany.mockResolvedValue([{ id: "c-cap", wikiSource: null, wikiPageTitle: "Caphiria" }]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(article(LEAD));

    const intro = await caller().getWikiRichIntro({ countryName: "Caphiria", countryId: "c-cap" });

    expect(reads()).toEqual([["Caphiria", "ixwiki"]]);
    expect(intro?.wikiUrl).toBe("/wiki/Caphiria");
    expect(intro?.paragraphs[0]).toContain('href="/wiki/Alharu"');
  });

  it("caches a lookup by name apart from a lookup by country", async () => {
    findMany.mockResolvedValue([{ id: "c-urc", wikiSource: "iiwiki", wikiPageTitle: "Urcea" }]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(article(LEAD));

    await caller().getWikiRichIntro({ countryName: "Urcea" });
    await caller().getWikiRichIntro({ countryName: "Urcea", countryId: "c-urc" });

    expect(reads()).toEqual([
      ["Urcea", "ixwiki"],
      ["Urcea", "iiwiki"],
    ]);
  });
});

describe("countries.getBulkWikiRichIntros", () => {
  it("reads each country's own page when it has one, in one query for all of them", async () => {
    findMany.mockResolvedValue([{ id: "b-tag", wikiSource: "iiwiki", wikiPageTitle: "Tagmatium" }]);
    jest.mocked(getArticleWikitextShadow).mockResolvedValue(article(LEAD));

    const intros = await caller().getBulkWikiRichIntros({
      countries: [
        { countryName: "Bulk Tagmatium", countryId: "b-tag" },
        { countryName: "Bulk Caphiria" },
      ],
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0].where.id.in).toEqual(["b-tag"]);
    expect(reads()).toEqual(
      expect.arrayContaining([
        ["Tagmatium", "iiwiki"],
        ["Bulk Caphiria", "ixwiki"],
      ])
    );
    expect(intros["Bulk Tagmatium"]?.wikiUrl).toBe("https://iiwiki.com/wiki/Tagmatium");
    expect(intros["Bulk Caphiria"]?.wikiUrl).toBe("/wiki/Bulk_Caphiria");
  });
});
