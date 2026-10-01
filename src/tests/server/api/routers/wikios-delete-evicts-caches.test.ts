/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a deleted page is gone from the geo, countries and cache readers at once, not when their caches
// expire: the readers are primed with the published page, the page is deleted through the real service,
// and they are asked again. Restoring it brings it back (the "missing" marks the delete left are gone).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    ...jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
    externalApiCache: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
  isDatabaseReadOnly: true,
}));
// The kick would run the mirror worker in a timer, after the test; the jobs themselves are real.
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  SYSTEM_OWNER_IDS: [],
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { getArticleIntro } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const MARKER = "CACHED-MARKER-4d2b8";
const admin = { userId: "u1", name: "Admin" };
const signedOut = () => createMockRouterContext({ auth: null, user: null }) as never;
const geoWiki = () => createCallerFactory(geoWikiRouter)(signedOut());
const countriesWiki = () => createCallerFactory(createTRPCRouter(wikiProcedures))(signedOut());
const wikiCache = () => createCallerFactory(wikiCacheRouter)(signedOut());

const fetchMock = jest.fn();
const realFetch = global.fetch;

/** Every reader that keeps what it read in a cache, asked for "Caphiria". */
const READERS: Array<[string, () => Promise<unknown>]> = [
  ["bridge.getArticleIntro", () => getArticleIntro("Caphiria", "ixwiki")],
  ["geo.getFeatureWikiIntro", () => geoWiki().getFeatureWikiIntro({ wikiPageTitle: "Caphiria" })],
  ["geo.parseWikiInfobox", () => geoWiki().parseWikiInfobox({ pageTitle: "Caphiria" })],
  ["countries.getWikiIntro", () => countriesWiki().getWikiIntro({ countryName: "Caphiria" })],
  [
    "countries.parseInfobox",
    () => countriesWiki().parseInfobox({ pageName: "Caphiria", site: "ixwiki" }),
  ],
  ["wikiCache.getCountryProfile", () => wikiCache().getCountryProfile({ countryName: "Caphiria" })],
];

const shows = async (read: () => Promise<unknown>) =>
  JSON.stringify((await read().catch(() => null)) ?? null).includes(MARKER);

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  wikiBridgeCache.clear();
  wikiCacheService.clearCache();
  fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  global.fetch = fetchMock as never;
  fakeWikiDb.tables.wikiArticle.seed({
    source: "ixwiki",
    title: "Caphiria",
    slug: "caphiria",
    namespace: 0,
    status: "PUBLISHED",
    wikitext: `{{Infobox country|name=${MARKER}}}\n${MARKER} is a kingdom.\n`,
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  });
});

afterAll(() => {
  global.fetch = realFetch;
});

describe.each(READERS)("%s", (_name, read) => {
  it("shows the page while it is published, then nothing once it is deleted, then the page again once it is restored", async () => {
    expect(await shows(read)).toBe(true); // primes the reader's cache
    expect(await shows(read)).toBe(true); // and is served from it

    await PageManagementService.archiveArticle("Caphiria", "spam", admin);
    expect(await shows(read)).toBe(false);

    await PageManagementService.restoreArticle("Caphiria", admin);
    expect(await shows(read)).toBe(true);
  });
});

describe("a moved page", () => {
  it("is read under its new name at once, and its old name no longer shows the page", async () => {
    expect(await shows(READERS[0]![1])).toBe(true);

    await PageManagementService.movePage(
      "Caphiria",
      "Kingdom of Caphiria",
      "tidy",
      admin,
      "ixwiki",
      {
        leaveRedirect: true,
        moveTalk: false,
      }
    );

    // The old name is a redirect page now: its intro is the redirect's, not the page's.
    expect(await shows(() => getArticleIntro("Caphiria", "ixwiki"))).toBe(false);
    expect(await shows(() => getArticleIntro("Kingdom of Caphiria", "ixwiki"))).toBe(true);
  });
});
