/** @jest-environment node */
/**
 * The /realms landing page: `realms.searchNations` finds nations across the realms the directory lists only
 * (never a draft, generating or unlisted realm), marks claimable ones, never leaks owner ids, and runs behind the
 * public rate limit; the directory counts each realm's claimable nation pages.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { rateLimiter } from "~/lib/cache";
import { realmsRouter } from "~/server/api/routers/realms";
import { NATION_SEARCH_LIMIT } from "~/server/api/routers/realms/places";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;

const EURTH = { id: "eurth", slug: "eurth", name: "Eurth" };
const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay" };

function makeDb(): Db {
  const db = createMockPrisma();
  db.realm.findMany.mockResolvedValue([IXNAY, EURTH]);
  db.country.findMany.mockImplementation(async ({ where }: any) => {
    // The "which pages has a country taken" lookup: Aurora by name (no page reference), Auberon renamed.
    if (where.OR)
      return [
        { realmId: "eurth", name: "Aurora", wikiSource: "ixwiki", wikiPageTitle: null },
        { realmId: "eurth", name: "New Auberon", wikiSource: "ixwiki", wikiPageTitle: "Auberon" },
      ];
    return [
      {
        id: "c1",
        name: "Aurelia",
        slug: "aurelia",
        flag: null,
        realmId: "eurth",
        ownerUserId: "u_secret",
      },
      {
        id: "c2",
        name: "Austral",
        slug: "austral",
        flag: "/f.png",
        realmId: "default",
        ownerUserId: null,
      },
    ];
  });
  db.realmPage.findMany.mockResolvedValue([
    { realmId: "eurth", title: "Aurora", wikiSource: "ixwiki" },
    { realmId: "eurth", title: "Auberon", wikiSource: "ixwiki" },
    { realmId: "eurth", title: "Auvergne", wikiSource: "ixwiki" },
  ]);
  return db;
}

function caller(db: Db) {
  return realmsRouter.createCaller(
    createMockRouterContext({ db, auth: null, user: null }) as never
  );
}

describe("realms.searchNations", () => {
  it("searches only the realms the directory lists", async () => {
    const db = makeDb();
    await caller(db).searchNations({ query: "  au " });

    expect(db.realm.findMany.mock.calls[0]![0].where).toEqual(DIRECTORY_REALM_WHERE);
    const countryWhere = db.country.findMany.mock.calls[0]![0].where;
    expect(countryWhere).toEqual({
      realmId: { in: ["default", "eurth"] },
      isDemo: false,
      claimable: true,
      name: { contains: "au", mode: "insensitive" },
    });
    expect(db.country.findMany.mock.calls[0]![0].take).toBe(NATION_SEARCH_LIMIT);
    expect(db.realmPage.findMany.mock.calls[0]![0].where).toEqual({
      realmId: { in: ["default", "eurth"] },
      kind: "nation",
      title: { contains: "au", mode: "insensitive" },
    });
  });
  it("caps the results", async () => {
    const db = makeDb();
    db.country.findMany.mockImplementation(async ({ where }: any) =>
      where.name?.in
        ? []
        : Array.from({ length: NATION_SEARCH_LIMIT }, (_, i) => ({
            id: `c${i}`,
            name: `Nation ${String(i).padStart(2, "0")}`,
            slug: null,
            flag: null,
            realmId: "eurth",
            ownerUserId: null,
          }))
    );
    const result = await caller(db).searchNations({ query: "na" });
    expect(result).toHaveLength(NATION_SEARCH_LIMIT);
  });
  it("refuses a query shorter than two letters", async () => {
    await expect(caller(makeDb()).searchNations({ query: " a " })).rejects.toThrow();
  });

  it("is refused over the public rate limit before touching the database", async () => {
    jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    jest.spyOn(rateLimiter, "check").mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date("2026-10-06T12:00:00Z"),
    });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = makeDb();
    await expect(caller(db).searchNations({ query: "au" })).rejects.toThrow(/Too many requests/);
    expect(db.realm.findMany).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
