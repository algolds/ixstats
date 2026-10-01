/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: the lore-card generator reads the live MediaWiki, which still has a page WikiOS deleted. Every
// list it returns and every preview it builds leaves that page out, and the wiki is not even asked about it.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
    systemConfig: { findMany: async () => [] },
  },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";

const fetchMock = jest.fn();
const realFetch = global.fetch;
/** The `titles=` parameter of every page query the generator sent to the wiki. */
const askedTitles = () =>
  fetchMock.mock.calls.flatMap(([url]) => new URL(String(url)).searchParams.get("titles") ?? []);

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
  it("does not ask the wiki about it, or preview it", async () => {
    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(
      ["Hidden_land", "Shown land"],
      "ixwiki"
    );

    expect(previews.map((preview) => preview.title)).toEqual(["Shown land"]);
    expect(askedTitles().join("|")).not.toContain("Hidden");
  });

  it("does not list it among a category's members, a wiki's pages or random pages", async () => {
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
  });
});
