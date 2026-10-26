/** @jest-environment node */
/**
 * wikiCacheService.getCountryProfile remembers a page the wiki does not have for a short while
 * (`MISSING_PROFILE_TTL_MS`), so a name with no page does not reach WikiBridge on every call. A wiki that cannot be
 * reached is a missing page for that call only, never remembered; invalidating the name forgets it at once, and
 * once the time is up the wiki is asked again.
 */
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({ getArticleWikitext: jest.fn() }));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { getArticleBySlug: jest.fn().mockResolvedValue(null) },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import {
  MISSING_PROFILE_TTL_MS,
  wikiCacheService,
} from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";

const read = jest.mocked(getArticleWikitext);
const page = (title: string, wikitext: string) => ({
  title,
  wikitext,
  pageId: 1,
  length: wikitext.length,
});
let now = 1_000_000;
let dateSpy: jest.SpyInstance<number, []>;

beforeEach(() => {
  wikiCacheService.clearCache();
  read.mockReset().mockResolvedValue(null);
  now += 10 * MISSING_PROFILE_TTL_MS;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => dateSpy.mockRestore());

describe("getCountryProfile of a name with no page", () => {
  it("asks the wiki once, then answers missing until the time is up", async () => {
    expect(await wikiCacheService.getCountryProfile("Nowhere", "iiwiki")).toBeNull();
    expect(await wikiCacheService.getCountryProfile("Nowhere", "iiwiki")).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);

    now += MISSING_PROFILE_TTL_MS + 1;
    await wikiCacheService.getCountryProfile("Nowhere", "iiwiki");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("never remembers an outage as missing", async () => {
    read.mockRejectedValueOnce(new WikiUnavailableError("IIWiki", "unreachable"));
    expect(await wikiCacheService.getCountryProfile("Elsewhere", "iiwiki")).toBeNull();

    read.mockResolvedValueOnce(page("Elsewhere", "'''Elsewhere''' is a land."));
    expect(await wikiCacheService.getCountryProfile("Elsewhere", "iiwiki")).toMatchObject({
      countryName: "Elsewhere",
    });
  });

  it("forgets the missing page when the name is invalidated", async () => {
    await wikiCacheService.getCountryProfile("New land", "ixwiki");
    wikiCacheService.clearCountryCache("new_land", "ixwiki");
    read.mockResolvedValueOnce(page("New land", "'''New land''' was founded."));

    expect(await wikiCacheService.getCountryProfile("New land", "ixwiki")).toMatchObject({
      countryName: "New land",
    });
  });
});
