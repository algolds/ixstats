/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// countries.getByIdWithEconomicData feeds the country header, the profile overview's sovereign pill
// (useCountryProfileLayer) and the MyCountry command bar. With wiki attribution (`showWikiAttribution`) off, the
// nation's owner reaches no client under their wiki name: `owner.wikiUsername` is blanked and `sovereignUser`
// falls through to the next name, for every viewer, the owner included (the pill links to their passport, whose
// handle skips the wiki name the same way). A switch that cannot be read hides the name.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/shared/clerk-public-profile", () => ({
  clerkPublicProfile: jest.fn(async () => ({ imageUrl: null, role: null })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { economyProcedures } from "~/server/api/routers/countries/economy";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { privacyConfigRow, wikiAttributionOff } from "~/tests/helpers/privacy-config-fake";

const countries = createTRPCRouter({ ...economyProcedures });

/** The owner as the procedure selects them (SOVEREIGN_OWNER_SELECT in countries/economy.ts). */
type OwnerRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    clerkUserId: true;
    handle: true;
    forumUsername: true;
    wikiUsername: true;
    membershipTier: true;
    role: { select: { displayName: true; name: true } };
  };
}>;

const OWNER: OwnerRow = {
  id: "owner_db",
  clerkUserId: "owner_clerk",
  handle: null,
  forumUsername: null,
  wikiUsername: "Wiki Ruler",
  membershipTier: "citizen",
  role: null,
};

function makeDb(owner: Partial<OwnerRow> = {}) {
  const db = createMockPrisma();
  db.country.findMany.mockResolvedValue([{ id: "c1", slug: "eldoria" }]);
  db.country.findFirst.mockResolvedValue({
    id: "c1",
    slug: "eldoria",
    name: "Eldoria",
    baselineDate: new Date(0),
    lastCalculated: new Date(0),
    storytellerEffects: [],
    owner: { ...OWNER, ...owner },
  });
  return db;
}

type Db = ReturnType<typeof makeDb>;
type Record_ = {
  owner: { wikiUsername: string | null; forumUsername: string | null } | null;
  sovereignUser: { username: string | null } | null;
};

const visitor = (db: Db) => createMockRouterContext({ db, auth: null, user: null });
const theOwner = (db: Db) =>
  createMockRouterContext({
    db,
    auth: { userId: "owner_clerk" },
    user: { id: "owner_db", clerkUserId: "owner_clerk", countryId: "c1", role: { name: "member" } },
  });

const read = async (ctx: ReturnType<typeof visitor>) =>
  (await createCallerFactory(countries)(ctx as never).getByIdWithEconomicData({
    id: "eldoria",
  })) as Record_;

describe("countries.getByIdWithEconomicData: the owner's wiki name and wiki attribution", () => {
  beforeEach(() => clearTrpcMemoryCache());

  it.each([
    ["a visitor", visitor],
    ["the owner", theOwner],
  ])("sends %s no wiki name of an owner with the switch off", async (_who, ctxFor) => {
    const db = makeDb({ forumUsername: "ForumRuler" });
    db.userConnection.findMany.mockResolvedValue(wikiAttributionOff("owner_clerk"));
    const record = await read(ctxFor(db));
    expect(record.owner).toMatchObject({ wikiUsername: null, forumUsername: "ForumRuler" });
    expect(record.sovereignUser?.username).toBe("ForumRuler");
    expect(JSON.stringify(record)).not.toContain("Wiki Ruler");
    expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps the wiki name of an owner with the switch on", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockResolvedValue([
      privacyConfigRow("owner_clerk", { showWikiAttribution: true }),
    ]);
    const record = await read(visitor(db));
    expect(record.owner?.wikiUsername).toBe("Wiki Ruler");
    expect(record.sovereignUser?.username).toBe("Wiki Ruler");
  });

  it("fails closed: a switch it cannot read hides the wiki name", async () => {
    const db = makeDb();
    db.userConnection.findMany.mockRejectedValue(new Error("db down"));
    const record = await read(visitor(db));
    expect(record.owner?.wikiUsername).toBeNull();
    expect(record.sovereignUser?.username).toBe("owner_clerk");
    expect(JSON.stringify(record)).not.toContain("Wiki Ruler");
  });

  it("reads no switch for an owner without a wiki name", async () => {
    const db = makeDb({ wikiUsername: null, handle: "ruler" });
    const record = await read(visitor(db));
    expect(record.sovereignUser?.username).toBe("ruler");
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });
});
