/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A1): IxWiki's wikitext is read from Postgres alone. A page Postgres has no text for does not
// exist; MediaWiki is never asked. A sister wiki's page is still fetched from its own wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import {
  ixwikiGetNamespacedWikitext,
  ixwikiGetWikitext,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-reader";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const article = db.wikiArticle as unknown as Record<"findUnique" | "findMany" | "findFirst", jest.Mock>;

const row = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  title: "Caphiria",
  source: "ixwiki",
  status: "PUBLISHED",
  format: "WIKITEXT",
  wikitext: "'''Caphiria''' is a country.",
  namespace: 0,
  namespacePrefix: null,
  protectionLevel: "ALL",
  syncedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  ...over,
});

let guard: FetchGuard;

afterEach(() => guard.restore());

beforeEach(() => {
  jest.clearAllMocks();
  article.findUnique.mockResolvedValue(null);
  article.findMany.mockResolvedValue([]);
  article.findFirst.mockResolvedValue(null);
  guard = installFetchGuard();
});

describe("ixwikiGetWikitext", () => {
  it("serves a page from Postgres", async () => {
    article.findUnique.mockResolvedValue(row());

    expect(await ixwikiGetWikitext("Caphiria")).toEqual({
      title: "Caphiria",
      wikitext: "'''Caphiria''' is a country.",
      pageId: 0,
      length: 28,
    });
    expect(guard.calls()).toEqual([]);
  });

  it("answers null for a page Postgres lacks, without asking MediaWiki", async () => {
    expect(await ixwikiGetWikitext("Nowhere")).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
  });

  it("answers null for a stub row with no text, without asking MediaWiki", async () => {
    article.findUnique.mockResolvedValue(row({ wikitext: "" }));

    expect(await ixwikiGetWikitext("Caphiria")).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
  });

  it("answers null for a deleted page, without asking MediaWiki", async () => {
    article.findUnique.mockResolvedValue(row({ status: "ARCHIVED" }));

    expect(await ixwikiGetWikitext("Caphiria")).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
  });
});

describe("ixwikiGetNamespacedWikitext", () => {
  it("serves a talk page from Postgres", async () => {
    article.findFirst.mockResolvedValue(
      row({ title: "User talk:Kir", namespace: 3, wikitext: "Hello" })
    );

    expect(await ixwikiGetNamespacedWikitext("Kir", 3)).toEqual({
      title: "User talk:Kir",
      wikitext: "Hello",
      pageId: 0,
      namespace: 3,
    });
  });

  it("answers null when Postgres has no such page, without asking MediaWiki", async () => {
    expect(await ixwikiGetNamespacedWikitext("Kir", 3)).toBeNull();
    expect(await ixwikiGetNamespacedWikitext("Kir", 2)).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
  });

  it("answers null for a deleted page, without asking MediaWiki", async () => {
    article.findFirst.mockResolvedValue(row({ title: "User:Kir", namespace: 2, status: "ARCHIVED" }));

    expect(await ixwikiGetNamespacedWikitext("Kir", 2)).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
  });
});

describe("getArticleWikitextShadow", () => {
  it("answers null for an IxWiki page Postgres lacks, without asking MediaWiki", async () => {
    expect(await getArticleWikitextShadow("Nowhere", "ixwiki")).toBeNull();
    expect(guard.ixwikiCalls()).toEqual([]);
    expect(guard.calls()).toEqual([]);
  });

  it("still hides a deleted page from a reader who may not see it", async () => {
    article.findUnique.mockResolvedValue(row({ status: "ARCHIVED" }));

    expect(await getArticleWikitextShadow("Caphiria", "ixwiki")).toBeNull();
    expect(await getArticleWikitextShadow("Caphiria", "ixwiki", { includeArchived: true })).toMatchObject({
      wikitext: "'''Caphiria''' is a country.",
    });
    expect(guard.calls()).toEqual([]);
  });
});

describe("a sister wiki's page", () => {
  it("is still fetched from its own wiki (iiwiki)", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      expect(url.hostname).toBe("iiwiki.com");
      return {
        query: {
          pages: { 7: { pageid: 7, title: "Elmeria", revisions: [{ slots: { main: { "*": "Sister text" } } }] } },
        },
      };
    });

    expect(await getArticleWikitext("Elmeria", "iiwiki")).toEqual({
      title: "Elmeria",
      pageId: 7,
      wikitext: "Sister text",
      length: 11,
    });
    expect(await getArticleWikitextShadow("Elmeria", "iiwiki")).toMatchObject({
      wikitext: "Sister text",
      fromShadow: false,
    });
    expect(guard.calls().every((url) => url.startsWith("https://iiwiki.com/"))).toBe(true);
    expect(guard.ixwikiCalls()).toEqual([]);
  });
});
