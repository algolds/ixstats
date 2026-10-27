/** @jest-environment node */
/** The admin's country wiki links (C1c): a link may point at any wiki WikiOS reads, AltHistory included. */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual<object>("~/lib/cache"),
  invalidateCache: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { adminWikiRouter } from "~/server/api/routers/admin/wiki";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(adminWikiRouter);
let db: MemoryPrisma;

const as = (role: { name: string; level: number }) =>
  createCaller(
    createMockRouterContext({
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role },
      db,
    }) as never
  );
const admin = () => as({ name: "admin", level: 10 });

const addCountry = (id: string) =>
  db.country.create({
    data: {
      id,
      name: `Nation ${id}`,
      slug: id,
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      maxGdpGrowthRate: 0,
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      currentPopulation: 1,
      currentGdpPerCapita: 1,
      currentTotalGdp: 1,
      economicTier: "Developing",
      populationTier: "Micro",
      baselineDate: new Date("2026-01-01T00:00:00Z"),
    },
  });

const linkOf = async (id: string) =>
  db.country.findUnique({ where: { id }, select: { wikiPageTitle: true, wikiSource: true } });

beforeEach(async () => {
  db = createMemoryPrisma();
  await db.user.create({ data: { id: "db_admin", clerkUserId: "admin_1" } });
  await db.realm.create({
    data: { id: "default", slug: "default", name: "Ixnay", ownerId: "admin_1" },
  });
  await addCountry("c1");
  await addCountry("c2");
});

describe("admin wiki links", () => {
  it("single and bulk links accept althistory", async () => {
    await admin().setWikiLink({
      countryId: "c1",
      wikiPageTitle: "Kingdom of Bohemia",
      wikiSource: "althistory",
    });
    expect(await linkOf("c1")).toEqual({
      wikiPageTitle: "Kingdom of Bohemia",
      wikiSource: "althistory",
    });

    await expect(
      admin().bulkSetWikiLinks({
        links: [
          { countryId: "c1", wikiPageTitle: "Avalon", wikiSource: "iiwiki" },
          { countryId: "c2", wikiPageTitle: "Greater Prussia", wikiSource: "althistory" },
        ],
      })
    ).resolves.toMatchObject({ updated: 2 });
    expect(await linkOf("c1")).toEqual({ wikiPageTitle: "Avalon", wikiSource: "iiwiki" });
    expect(await linkOf("c2")).toEqual({
      wikiPageTitle: "Greater Prussia",
      wikiSource: "althistory",
    });
  });

  it("a link with no source is IxWiki's, and a wiki WikiOS does not read is refused", async () => {
    await admin().setWikiLink({ countryId: "c1", wikiPageTitle: "Burgundie" });
    expect(await linkOf("c1")).toEqual({ wikiPageTitle: "Burgundie", wikiSource: "ixwiki" });

    await expect(
      admin().setWikiLink({
        countryId: "c1",
        wikiPageTitle: "Earth",
        wikiSource: "commons" as never,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      admin().bulkSetWikiLinks({
        links: [{ countryId: "c2", wikiPageTitle: "Earth", wikiSource: "commons" as never }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await linkOf("c2")).toEqual({ wikiPageTitle: null, wikiSource: "ixwiki" });
  });

  it("stays an admin procedure", async () => {
    await expect(
      as({ name: "user", level: 100 }).setWikiLink({
        countryId: "c1",
        wikiPageTitle: "Avalon",
        wikiSource: "althistory",
      })
    ).rejects.toThrow(/Admin privileges required/);
  });
});
