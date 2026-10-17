/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// The daily import's draw from a sister wiki (spike-sources.md, rule 5): random pages with a page image, read through
// mwJson, so a wiki that refuses (HTTP 403 or 429, `readapidenied`, a challenge page) throws DiscoveryStopped and any
// other failed answer throws. Neither is turned into "no pages", so the daily import can report the wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: async () => [] } },
  isDatabaseReadOnly: true,
}));

import { afterEach, describe, expect, it } from "@jest/globals";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** IIWiki answering every request with `body`; the requests are recorded. */
function iiwikiAnswers(status: number, body: string, type = "application/json") {
  const requests: Array<{ url: URL; signal: boolean }> = [];
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    requests.push({ url: new URL(input), signal: init?.signal instanceof AbortSignal });
    return new Response(body, { status, headers: { "content-type": type } });
  }) as typeof fetch;
  return requests;
}

const draw = (count: number) => loreCardDiscovery.fetchRandomArticlesWithImages(count, "iiwiki");

describe("fetchRandomArticlesWithImages on a sister wiki", () => {
  it("draws random pages that have a page image, at most the count asked, in one timed request", async () => {
    const original = { source: "https://iiwiki.com/images/a/ab/Elm.png" };
    const requests = iiwikiAnswers(
      200,
      JSON.stringify({
        query: {
          pages: {
            1: { title: "Elm", original },
            2: { title: "Oak" },
            3: { title: "Ash", original },
          },
        },
      })
    );
    await expect(draw(1)).resolves.toEqual(["Elm"]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.signal).toBe(true);
    expect(Object.fromEntries(requests[0]!.url.searchParams)).toMatchObject({
      generator: "random",
      grnnamespace: "0",
      grnlimit: "3",
      prop: "pageimages",
    });
  });

  it.each([
    ["HTTP 403", 403, "", "IIWiki stopped answering (HTTP 403)."],
    ["HTTP 429", 429, "", "IIWiki stopped answering (HTTP 429)."],
    [
      "readapidenied",
      200,
      JSON.stringify({ error: { code: "readapidenied", info: "You need read permission" } }),
      "IIWiki does not allow reading its pages.",
    ],
    [
      "a challenge page",
      200,
      "<!DOCTYPE html><title>Just a moment...</title>",
      "IIWiki answered with a web page instead of data.",
    ],
  ])("stops on a refusal (%s)", async (_name, status, body, message) => {
    iiwikiAnswers(status, body);
    const drawn = draw(5);
    await expect(drawn).rejects.toBeInstanceOf(DiscoveryStopped);
    await expect(drawn).rejects.toThrow(message);
  });

  it("throws, without stopping, on any other failed answer", async () => {
    iiwikiAnswers(503, "");
    const drawn = draw(5);
    await expect(drawn).rejects.toThrow("IIWiki answered HTTP 503.");
    await expect(drawn).rejects.not.toBeInstanceOf(DiscoveryStopped);
  });
});
