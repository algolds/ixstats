/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Plan 419: a sister wiki's file and category reads go through the shared upstream fetch, so an upstream
// failure reaches the client as an error (never as an empty list), and counts are keyed by the names asked.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiCategory: { findMany: jest.fn() },
    wikiAsset: { findMany: jest.fn() },
    wikiArticle: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosCategoriesRouter } from "~/server/api/routers/wikios/categories";
import { wikiosSearchRouter } from "~/server/api/routers/wikios/search";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const ctx = () => createMockRouterContext({ auth: null, user: null }) as never;
const categories = () => createCallerFactory(wikiosCategoriesRouter)(ctx());
const search = () => createCallerFactory(wikiosSearchRouter)(ctx());

const realFetch = globalThis.fetch;
let guard: FetchGuard | null = null;
afterEach(() => {
  guard?.restore();
  guard = null;
  globalThis.fetch = realFetch;
});
beforeEach(() => jest.clearAllMocks());

function failUpstream(status: number) {
  globalThis.fetch = jest.fn(
    async () => new Response("upstream down", { status })
  ) as unknown as typeof fetch;
}

describe("a failing sister wiki is an error, not an empty list", () => {
  it("searchFiles rejects with a TRPCError when iiwiki answers 500", async () => {
    failUpstream(500);

    const failure = search().searchFiles({ query: "fail-search-files", wiki: "iiwiki" });

    await expect(failure).rejects.toBeInstanceOf(TRPCError);
    await expect(failure).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("searchCategories, getCategories, getSubcategories and autocompleteCategories reject too", async () => {
    failUpstream(503);

    await expect(
      categories().searchCategories({ query: "fail-sc", wiki: "iiwiki" })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    await expect(categories().getCategories({ wiki: "iiwiki", limit: 7 })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    await expect(
      categories().getSubcategories({ category: "fail-sub", wiki: "iiwiki" })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    await expect(
      categories().autocompleteCategories({ prefix: "fail-ac", wiki: "iiwiki" })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("getCategoryTotalCounts rejects instead of answering {}", async () => {
    failUpstream(500);

    await expect(
      categories().getCategoryTotalCounts({ categories: ["fail-counts"], wiki: "iiwiki" })
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("an upstream 429 reaches the client as TOO_MANY_REQUESTS", async () => {
    failUpstream(429);

    await expect(
      search().searchFiles({ query: "fail-429", wiki: "iiwiki" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("sister wiki getCategoryTotalCounts", () => {
  it("keys counts by the names asked (normalized titles mapped back) and omits categories the wiki did not answer", async () => {
    guard = installFetchGuard(() => ({
      query: {
        normalized: [{ from: "Category:Flag_images", to: "Category:Flag images" }],
        pages: {
          "10": { title: "Category:Flag images", categoryinfo: { files: 12 } },
          "11": { title: "Category:Empty", categoryinfo: { files: 0 } },
        },
      },
    }));

    const result = await categories().getCategoryTotalCounts({
      categories: ["Flag_images", "Empty", "Unanswered"],
      wiki: "iiwiki",
    });

    expect(result).toEqual({ Flag_images: 12, Empty: 0 });
    expect("Unanswered" in result).toBe(false);
  });

  it("answers a repeated identical request from the 5-minute cache", async () => {
    guard = installFetchGuard(() => ({ query: { allcategories: [{ "*": "Cached" }] } }));

    await categories().autocompleteCategories({ prefix: "cache-me", wiki: "iiwiki" });
    await categories().autocompleteCategories({ prefix: "cache-me", wiki: "iiwiki" });

    expect(guard.calls()).toHaveLength(1);
  });
});
