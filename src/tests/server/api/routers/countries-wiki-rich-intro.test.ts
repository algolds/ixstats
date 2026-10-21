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
