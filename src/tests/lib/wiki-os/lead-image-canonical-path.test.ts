/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (D2): a lead image is stored as the canonical path `/images/<shard>/<File>`: no host, no proxy, no
// deployment base path. Every reader turns it into the URL a page loads it from, under the base path that
// deployment is served at; a row written before (a URL that already loads) is passed through unchanged.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findMany: jest.fn() },
    wikiRevision: { findMany: jest.fn() },
    wikiAccountLink: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import {
  extractLeadImageFromWikitext,
  extractLeadImagePath,
  getImagePath,
  getImageUrl,
  getMd5ShardPath,
  resolveStoredImageUrl,
} from "~/lib/wiki-os/transformers/image-url";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { ixwikiRecentChanges } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";

const mocked = db as unknown as {
  wikiArticle: { findMany: jest.Mock };
  wikiRevision: { findMany: jest.Mock };
  $queryRawUnsafe: jest.Mock;
};

const BASE_PATH = "/projects/ixstats";
const shard = (file: string) => getMd5ShardPath(file).fullPath;

let savedBasePath: string | undefined;
beforeEach(() => {
  savedBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
});
afterEach(() => {
  if (savedBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBasePath;
});

describe("the stored form of a lead image", () => {
  it("is the canonical path, whatever base path the deployment is served at", () => {
    const wikitext = "{{Infobox country|image = Flag of Caphiria.svg}}";

    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const atRoot = extractLeadImagePath(wikitext);
    process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
    const underBase = extractLeadImagePath(wikitext);

    expect(atRoot).toBe(`/images/${shard("Flag of Caphiria.svg")}`);
    expect(atRoot).toMatch(/^\/images\/[0-9a-f]\/[0-9a-f]{2}\/Flag_of_Caphiria\.svg$/);
    expect(underBase).toBe(atRoot);
    expect(getImagePath("Flag of Caphiria.svg")).toBe(atRoot);
  });

  it("is null for a page with no lead image", () => {
    expect(extractLeadImagePath("Just text.")).toBeNull();
    expect(extractLeadImagePath(null)).toBeNull();
  });

  it("names the same file as the URL form a client page loads directly", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const wikitext = "[[File:Map of Caphiria.png|thumb]] text";

    expect(extractLeadImageFromWikitext(wikitext)).toBe(getImageUrl("Map of Caphiria.png"));
    expect(resolveStoredImageUrl(extractLeadImagePath(wikitext))).toBe(
      extractLeadImageFromWikitext(wikitext)
    );
  });
});

describe("resolveStoredImageUrl", () => {
  const canonical = `/images/${shard("Map.png")}`;

  it("loads a canonical path through the image proxy under the base path of the deployment", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(resolveStoredImageUrl(canonical)).toBe(`/api/mediawiki/ixwiki${canonical}`);

    process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
    expect(resolveStoredImageUrl(canonical)).toBe(`${BASE_PATH}/api/mediawiki/ixwiki${canonical}`);
  });

  it("leaves a row written before as it is: a proxied path keeps the base path it was written under", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = BASE_PATH;
    const legacy = `${BASE_PATH}/api/mediawiki/ixwiki${canonical}`;

    expect(resolveStoredImageUrl(legacy)).toBe(legacy);
    expect(resolveStoredImageUrl(`/api/mediawiki/ixwiki${canonical}`)).toBe(
      `/api/mediawiki/ixwiki${canonical}`
    );
  });

  it("proxies a stored absolute IxWiki URL as before, and leaves another host's alone", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;

    expect(resolveStoredImageUrl(`https://ixwiki.com${canonical}`)).toBe(
      `/api/mediawiki/ixwiki${canonical}`
    );
    expect(resolveStoredImageUrl("https://example.org/pic.png")).toBe("https://example.org/pic.png");
  });

  it("is null for no image", () => {
    expect(resolveStoredImageUrl(null)).toBeNull();
    expect(resolveStoredImageUrl(undefined)).toBeNull();
    expect(resolveStoredImageUrl("")).toBeNull();
  });

  it("resolves what getImageUrl gave at the root (the form a row of this deployment may hold)", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(resolveStoredImageUrl(getImageUrl("Map.png"))).toBe(getImageUrl("Map.png"));
  });
});

describe("readers turn the stored path into a loadable URL", () => {
  const canonical = `/images/${shard("Map.png")}`;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  it("title search results", async () => {
    // The typeahead is one raw query over the search index.
    mocked.$queryRawUnsafe.mockResolvedValue([
      {
        id: "a1",
        title: "Caphiria",
        summary: "A country.",
        readingTime: 1,
        leadImageUrl: canonical,
        tier: 1,
        similarity: 0.8,
      },
      {
        id: "a2",
        title: "Caphiria City",
        summary: null,
        readingTime: 1,
        leadImageUrl: null,
        tier: 1,
        similarity: 0.6,
      },
    ]);

    const results = await NativeSearchService.spotlightSearch("Caph", "ixwiki", 5);

    expect(results.map((r) => r.leadImageUrl)).toEqual([`/api/mediawiki/ixwiki${canonical}`, null]);
  });

  it("recent changes thumbnails", async () => {
    mocked.wikiRevision.findMany.mockResolvedValue([
      {
        author: "Kir",
        summary: "",
        parked: false,
        byteSize: 5,
        byteDelta: 5,
        createdAt: new Date("2026-09-27T10:00:00Z"),
        article: { title: "Foo", summary: null, leadImageUrl: canonical },
      },
    ]);

    const [change] = await ixwikiRecentChanges(5);

    expect(change?.thumbnail).toBe(`/api/mediawiki/ixwiki${canonical}`);
  });
});
