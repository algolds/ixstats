/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// Callers outside WikiOS's read surfaces keep the outcome they had before sister reads threw WikiUnavailableError
// (plan 2026-10-25 sister wikis, C3b): an unreachable wiki reads as a missing page there, by `unlessUnavailable`.
// The map's wiki lookups try the next wiki, a lore card's excerpt is empty, a country's infobox parse is NOT_FOUND
// and the wiki cache has no page. Any other error still fails.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleIntro: jest.fn(),
  getArticleWikitext: jest.fn(),
  searchPages: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { getArticleBySlug: jest.fn(async () => null) },
}));
jest.mock("~/server/api/trpc/realm-scope", () => ({
  ...jest.requireActual<typeof import("~/server/api/trpc/realm-scope")>(
    "~/server/api/trpc/realm-scope"
  ),
  // Ixnay: its lookup order is IxWiki, then IIWiki.
  viewerRealmId: jest.fn(
    async () =>
      jest.requireActual<typeof import("~/lib/realms/realm-ids")>("~/lib/realms/realm-ids")
        .DEFAULT_REALM_ID
  ),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import {
  getArticleIntro,
  getArticleWikitext,
  searchPages,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import type {
  WikiArticle,
  WikiIntro,
  WikiSearchResult,
  WikiSource,
} from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { createCallerFactory } from "~/server/api/trpc";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import { cardsSheetRouter } from "~/server/api/routers/cards/sheet";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { createTRPCRouter } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const intro = jest.mocked(getArticleIntro);
const wikitext = jest.mocked(getArticleWikitext);
const search = jest.mocked(searchPages);
const shadow = jest.mocked(getArticleWikitextShadow);

const visitor = () => createMockRouterContext({ auth: null, user: null, db: {} }) as never;
const geo = () => createCallerFactory(geoWikiRouter)(visitor());

const unreachable = (wiki = "IIWiki") => new WikiUnavailableError(wiki, "unreachable");

const PAGE: WikiArticle = {
  title: "Aurelia",
  pageId: 4,
  wikitext: "{{Infobox settlement|name=Aurelia}}\n'''Aurelia''' is a city.",
  length: 60,
};

/** Each wiki's answer: a value, or an error it throws. */
function byWiki<T>(answers: Partial<Record<WikiSource, T | Error>>) {
  return async (_title: string, ...rest: Array<WikiSource | number | undefined>): Promise<T> => {
    const wiki = rest.find((arg): arg is WikiSource => typeof arg === "string") ?? "ixwiki";
    const answer = answers[wiki];
    if (answer instanceof Error) throw answer;
    return answer as T;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearTrpcMemoryCache();
});

describe("the map's wiki lookups (geo.wiki)", () => {
  it("the wiki intro tries the next wiki when one is unreachable, as when the page is missing", async () => {
    intro.mockImplementation(
      byWiki<WikiIntro | null>({
        ixwiki: unreachable("The wiki"),
        iiwiki: { title: "Aurelia", text: "A city." },
      })
    );

    await expect(geo().getFeatureWikiIntro({ wikiPageTitle: "Aurelia" })).resolves.toMatchObject({
      extract: "A city.",
      wikiSource: "iiwiki",
    });

    intro.mockImplementation(byWiki<WikiIntro | null>({ ixwiki: null, iiwiki: unreachable() }));
    await expect(geo().getFeatureWikiIntro({ wikiPageTitle: "Bashan" })).resolves.toBeNull();
    expect(intro).toHaveBeenLastCalledWith("Bashan", "iiwiki");
  });

  it("an infobox lookup of an unreachable wiki is not found, as a missing page", async () => {
    wikitext.mockImplementation(
      byWiki<WikiArticle | null>({ ixwiki: unreachable("The wiki"), iiwiki: PAGE })
    );
    await expect(geo().parseWikiInfobox({ pageTitle: "Aurelia" })).resolves.toMatchObject({
      found: true,
      wikiSource: "iiwiki",
    });

    wikitext.mockImplementation(
      byWiki<WikiArticle | null>({ ixwiki: null, iiwiki: unreachable() })
    );
    await expect(geo().parseWikiInfobox({ pageTitle: "Bashan" })).resolves.toMatchObject({
      found: false,
      wikiSource: null,
    });
  });

  it("a search of an unreachable wiki finds nothing there and tries the next", async () => {
    search.mockImplementation(
      byWiki<WikiSearchResult[]>({
        ixwiki: unreachable("The wiki"),
        iiwiki: [{ title: "Aurelia", pageId: 1, length: 0 }],
      })
    );
    await expect(geo().searchWikiPages({ query: "Aur" })).resolves.toMatchObject({
      wikiSource: "iiwiki",
      results: [{ title: "Aurelia" }],
    });

    search.mockImplementation(byWiki<WikiSearchResult[]>({ ixwiki: [], iiwiki: unreachable() }));
    await expect(geo().searchWikiPages({ query: "Bash" })).resolves.toEqual({
      wikiSource: null,
      results: [],
    });
  });

  it("any other error still fails", async () => {
    intro.mockImplementation(byWiki<WikiIntro | null>({ ixwiki: null, iiwiki: new Error("boom") }));
    await expect(geo().getFeatureWikiIntro({ wikiPageTitle: "Cassia" })).rejects.toThrow("boom");

    wikitext.mockImplementation(byWiki<WikiArticle | null>({ ixwiki: new Error("boom") }));
    await expect(geo().parseWikiInfobox({ pageTitle: "Cassia" })).rejects.toThrow("boom");

    search.mockImplementation(byWiki<WikiSearchResult[]>({ ixwiki: new Error("boom") }));
    await expect(geo().searchWikiPages({ query: "Cass" })).rejects.toThrow("boom");
  });
});

describe("a lore card's wiki excerpt (cards.getWikiArticleExcerpt)", () => {
  const sheet = () => createCallerFactory(cardsSheetRouter)(visitor());

  it("is empty when the wiki is unreachable, as for a missing page", async () => {
    wikitext.mockRejectedValue(unreachable());
    intro.mockRejectedValue(unreachable());

    await expect(
      sheet().getWikiArticleExcerpt({ articleTitle: "Aurelia", wikiSource: "iiwiki" })
    ).resolves.toEqual({ extract: null, wikitext: null });
  });

  it("falls back to the intro when the wikitext read is unavailable, and still fails on any other error", async () => {
    wikitext.mockRejectedValue(unreachable());
    intro.mockResolvedValue({ title: "Aurelia", text: "A city." });
    await expect(
      sheet().getWikiArticleExcerpt({ articleTitle: "Aurelia", wikiSource: "iiwiki" })
    ).resolves.toEqual({ extract: "A city.", wikitext: "A city." });

    wikitext.mockResolvedValue(null);
    intro.mockRejectedValue(new Error("boom"));
    await expect(
      sheet().getWikiArticleExcerpt({ articleTitle: "Aurelia", wikiSource: "iiwiki" })
    ).rejects.toThrow("boom");
  });
});

describe("a country's infobox parse (countries.parseInfobox)", () => {
  const countries = () => createCallerFactory(createTRPCRouter(wikiProcedures))(visitor());

  it("is NOT_FOUND when the wiki is unreachable, as for a missing page", async () => {
    shadow.mockRejectedValue(unreachable());

    const error = await countries()
      .parseInfobox({ pageName: "Unreached Land", site: "iiwiki" })
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("the wiki cache (wikiCacheService)", () => {
  it("has no page, template or profile when the wiki is unreachable", async () => {
    wikitext.mockRejectedValue(unreachable());

    await expect(wikiCacheService.getPage("Unreached Page", "iiwiki")).resolves.toBeNull();
    await expect(wikiCacheService.getTemplate("Unreached box", "iiwiki")).resolves.toBeNull();
    await expect(
      wikiCacheService.getCountryProfile("Unreached Country", "iiwiki")
    ).resolves.toBeNull();
  });

  it("still fails on any other error", async () => {
    wikitext.mockRejectedValue(new Error("boom"));

    await expect(wikiCacheService.getPage("Broken Page", "iiwiki")).rejects.toThrow("boom");
    await expect(wikiCacheService.getTemplate("Broken box", "iiwiki")).rejects.toThrow("boom");
    await expect(wikiCacheService.getCountryProfile("Broken Country", "iiwiki")).rejects.toThrow(
      "boom"
    );
  });
});
