/** @jest-environment node */
/** AT-12: map wiki lookups use the realm's wiki; Ixnay keeps ixwiki then iiwiki. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleIntro: jest.fn(),
  getArticleWikitext: jest.fn(),
  searchPages: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import * as bridge from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(geoWikiRouter);
const getArticleIntro = bridge.getArticleIntro as jest.Mock;
const searchPages = bridge.searchPages as jest.Mock;

function caller(db: ReturnType<typeof createMockPrisma>) {
  return createCaller(createMockRouterContext({ db, auth: null, user: null }) as never);
}

const wikisTried = (mock: jest.Mock, wikiArg: number) => mock.mock.calls.map((c) => c[wikiArg]);

beforeEach(() => {
  getArticleIntro.mockReset().mockResolvedValue(null);
  searchPages.mockReset().mockResolvedValue([]);
});

describe("geoWiki realm wiki source", () => {
  it("keeps Ixnay's ixwiki-then-iiwiki order", async () => {
    const db = createMockPrisma();
    await caller(db).getFeatureWikiIntro({ wikiPageTitle: "Lucrecia" });

    expect(wikisTried(getArticleIntro, 1)).toEqual(["ixwiki", "iiwiki"]);
    expect(db.realmPage.findFirst).not.toHaveBeenCalled();
  });
  it("searches only the realm's wiki", async () => {
    const db = createMockPrisma();
    db.realm.findUnique.mockResolvedValue({ id: "realm_alt" });
    db.realmPage.findFirst.mockResolvedValue({ wikiSource: "althistory" });
    await caller(db).searchWikiPages({ query: "Ber", realm: "alt" });

    expect(wikisTried(searchPages, 2)).toEqual(["althistory"]);
  });
});
