/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: the lore-card routes read the live MediaWiki, which still has a page WikiOS deleted. They
// return nothing about that page (the real generator and a fake database run behind them).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
    systemConfig: { findMany: async () => [] },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/app/api/mediawiki/_rate-limit", () => ({
  wikiProxyRateLimitResponse: async () => null,
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { GET as randomArticles } from "~/app/api/wiki/random-articles/route";
import { GET as categoryArticles } from "~/app/api/wiki/category-articles/route";
import { GET as previewArticle } from "~/app/api/wiki/preview-article/route";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const fetchMock = jest.fn();
const realFetch = global.fetch;

/** A MediaWiki that has both pages, whatever is asked. */
function wikiWithBothPages(url: string) {
  const params = new URL(url).searchParams;
  const both = ["Hidden land", "Shown land"];
  if (params.get("list") === "random")
    return { query: { random: both.map((title) => ({ title })) } };
  if (params.get("list") === "categorymembers") {
    return { query: { categorymembers: both.map((title) => ({ title })) } };
  }
  const asked = (params.get("titles") ?? "").split("|").filter(Boolean);
  return {
    query: { pages: Object.fromEntries(asked.map((title, i) => [i, { title, extract: "text" }])) },
  };
}

const get = (path: string) => new Request(`http://localhost:3000/api/wiki/${path}`);

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

describe("the lore-card routes leave out a page WikiOS deleted", () => {
  it("random-articles", async () => {
    const body = await (await randomArticles(get("random-articles?source=ixwiki&count=10&minQuality=0"))).json();
    expect(body.articles.map((a: { title: string }) => a.title)).toEqual(["Shown land"]);
  });

  it("category-articles", async () => {
    const res = await categoryArticles(get("category-articles?source=ixwiki&category=Nations&minQuality=0"));
    const body = await res.json();
    expect(body.articles.map((a: { title: string }) => a.title)).toEqual(["Shown land"]);
  });

  it("preview-article", async () => {
    const res = await previewArticle(get("preview-article?source=ixwiki&title=Hidden_land"));
    expect(res.status).toBe(500); // the generator refuses a page that is not there; no preview
    expect(JSON.stringify(await res.json())).not.toContain("Hidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
