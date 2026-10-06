/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a page WikiOS deleted is left out of every list the lore-card generator returns and every preview
// it builds. Plan 418: IxWiki's pages are read from Postgres (the queries name the published pages, and no wiki
// is asked); a sister wiki's pages are still read from that wiki, which the generator holds to WikiOS's deletions.
jest.mock("~/server/db", () => {
  const helpers = jest.requireActual("~/tests/helpers/fake-lore-card-db");
  return {
    __esModule: true,
    db: {
      ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
      systemConfig: { findMany: async () => [] },
      ...helpers.loreCardDbExtras(helpers.loreCardQueryRaw),
    },
    isDatabaseReadOnly: true,
  };
});

import { describe, it, expect, beforeEach } from "@jest/globals";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";

const fetchMock = jest.fn();
const realFetch = global.fetch;
const live = (title: string) => ({ title, original: { source: `https://img/${title}.png` } });

/** A MediaWiki that has both pages, whatever is asked. */
function wikiWithBothPages(url: string) {
  const params = new URL(url).searchParams;
  const both = ["Hidden land", "Shown land"];
  if (params.get("list") === "random")
    return { query: { random: both.map((title) => ({ title })) } };
  if (params.get("list") === "categorymembers") {
    return { query: { categorymembers: both.map((title) => ({ title })) } };
  }
  if (params.get("list") === "allpages")
    return { query: { allpages: both.map((title) => ({ title })) } };
  if (params.get("generator") === "random") {
    return { query: { pages: { 1: live("Hidden land"), 2: live("Shown land") } } };
  }
  const asked = (params.get("titles") ?? "").split("|").filter(Boolean);
  return {
    query: { pages: Object.fromEntries(asked.map((title, i) => [i, { title, extract: "text" }])) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => wikiWithBothPages(String(url)),
  }));
  global.fetch = fetchMock as never;
  fakeWikiDb.tables.wikiArticle.seed(
    { source: "ixwiki", title: "Hidden land", slug: "hidden_land", status: "ARCHIVED" },
    { source: "ixwiki", title: "Shown land", slug: "shown_land", status: "PUBLISHED" }
  );
});

afterAll(() => {
  global.fetch = realFetch;
});

describe("the lore-card generator leaves out a page WikiOS deleted", () => {
  it("previews only the published page, and no wiki is asked", async () => {
    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
      ["Hidden_land", "Shown land"],
      "ixwiki"
    );

    expect(previews.map((preview) => preview.title)).toEqual(["Shown land"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not list it among a category's members, a wiki's pages or random pages, and no wiki is asked", async () => {
    expect(await wikiLoreCardGenerator.fetchCategoryMembers("Nations", "ixwiki")).toEqual([
      "Shown land",
    ]);
    expect(await wikiLoreCardGenerator.fetchAllMainNamespacePages("ixwiki")).toEqual([
      "Shown land",
    ]);
    expect(await wikiLoreCardGenerator.fetchRandomArticles(10, "ixwiki")).toEqual(["Shown land"]);
    expect(await wikiLoreCardGenerator.fetchRandomArticlesWithImages(10, "ixwiki")).toEqual([
      "Shown land",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes no card from it, and never reads its text from the wiki", async () => {
    await expect(wikiLoreCardGenerator.generateCard("Hidden land", "ixwiki")).rejects.toThrow(
      "was not found"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not hold a page of another wiki to WikiOS's deletions", async () => {
    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
      ["Hidden land"],
      "iiwiki"
    );
    expect(previews.map((preview) => preview.title)).toEqual(["Hidden land"]);
    // It went to iiwiki, not to IxWiki's tables.
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("iiwiki.com");
  });
});
