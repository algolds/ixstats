/** @jest-environment node */
/**
 * Auto-Match in the world editor: realm-scoped, read in pages past the 1,000-row guard, fuzzy (with the roster's
 * nation page titles and the nations' source keys as aliases), reviewed before anything uncertain is linked, and
 * able to give one nation several regions.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/country-geo", () => ({ syncCountryGeometryFromMapLayer: jest.fn() }));

import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorLinkageValidationRouter } from "~/server/api/routers/geo/editor/linkage/validation";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const MAP_OFFICER = "clerk_mapper";

type Row = { id: string; [key: string]: unknown };

/** findMany over `rows` honouring `take`, `cursor` and `skip` like Prisma's id-ordered paging. */
function pagedFindMany(rows: Row[]) {
  return jest.fn(async (args: { take?: number; cursor?: { id: string }; skip?: number }) => {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const start = args.cursor
      ? sorted.findIndex((r) => r.id === args.cursor!.id) + (args.skip ?? 0)
      : 0;
    return sorted.slice(start, start + (args.take ?? sorted.length));
  });
}

function setup({
  regions,
  countries,
  pages = [],
}: {
  regions: Row[];
  countries: Row[];
  pages?: Row[];
}) {
  const db = {
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug === "eurth" || where.id === EURTH
          ? {
              id: EURTH,
              ownerId: "clerk_founder",
              status: "active",
              officers: [{ userId: MAP_OFFICER, powers: ["map"] }],
            }
          : null
      ),
    },
    mapLayer: {
      findMany: pagedFindMany(regions),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    country: {
      findMany: jest.fn(async (args: { where: { id?: { in: string[] } }; take?: number }) =>
        args.where.id?.in
          ? countries.filter((c) => args.where.id!.in.includes(c.id))
          : pagedFindMany(countries)(args)
      ),
    },
    realmPage: { findMany: pagedFindMany(pages) },
  };
  const caller = createCallerFactory(geoEditorLinkageValidationRouter)(
    createMockRouterContext({
      db,
      auth: { userId: MAP_OFFICER },
      user: { id: "db_mapper", clerkUserId: MAP_OFFICER, role: null, country: null },
      rateLimitIdentifier: `${MAP_OFFICER}_${Math.random()}`,
    }) as never
  );
  return { db, caller };
}

const region = (id: string, featureId: string, displayName: string | null = null) => ({
  id,
  featureId,
  displayName,
});

beforeEach(() => {
  clearTrpcMemoryCache();
  (syncCountryGeometryFromMapLayer as jest.Mock).mockClear();
});

describe("Auto-Match", () => {
  it("suggests matches for review with their confidence, using roster page titles and source keys", async () => {
    const { caller, db } = setup({
      regions: [
        region("m1", "Republic_of_Gallambria"),
        region("m2", "OST"),
        region("m3", "f3", "Bergmarck"),
      ],
      countries: [
        { id: "c_gal", name: "Gallambria", wikiPageTitle: null, externalSourceKey: null },
        { id: "c_ost", name: "Ostia", wikiPageTitle: null, externalSourceKey: "OST" },
        { id: "c_ber", name: "Bergmark", wikiPageTitle: null, externalSourceKey: null },
      ],
      pages: [{ id: "p1", title: "Republic of Gallambria" }],
    });
    const result = await caller.suggestLinkageMatches({ realm: "eurth" });

    expect(result.unlinkedRegions).toBe(3);
    expect(
      result.suggestions.map((s) => [s.featureId, s.countryId, s.reason, s.matchedOn])
    ).toEqual([
      ["OST", "c_ost", "exact", "OST"],
      ["Republic_of_Gallambria", "c_gal", "exact", "Republic of Gallambria"],
      ["f3", "c_ber", "similar", "Bergmark"],
    ]);
    // Every read is the edited realm's
    expect(db.mapLayer.findMany.mock.calls[0][0].where).toMatchObject({
      realmId: EURTH,
      countryId: null,
    });
    expect(db.country.findMany.mock.calls[0][0].where).toMatchObject({ realmId: EURTH });
    expect(db.realmPage.findMany.mock.calls[0][0].where).toEqual({
      realmId: EURTH,
      kind: "nation",
    });
  });

  it("reads every region and nation in pages, past the 1,000-row guard", async () => {
    const regions = Array.from({ length: 1203 }, (_, i) =>
      region(`m${String(i).padStart(5, "0")}`, `Region ${i}`)
    );
    const { caller, db } = setup({
      regions,
      countries: [
        { id: "c_last", name: "Region 1202", wikiPageTitle: null, externalSourceKey: null },
      ],
    });
    const result = await caller.suggestLinkageMatches({ realm: "eurth" });
    expect(result.unlinkedRegions).toBe(1203);
    expect(result.suggestions.map((s) => s.featureId)).toContain("Region 1202");
    expect(db.mapLayer.findMany.mock.calls.length).toBeGreaterThan(2);
    for (const [args] of db.mapLayer.findMany.mock.calls) expect(args.take).toBeDefined();
  });

  it("links only confident matches on its own, and gives one nation all its regions", async () => {
    const { caller, db } = setup({
      regions: [region("m1", "Ostia"), region("m2", "ostia_isles", "Ostia"), region("m3", "Ostai")],
      countries: [{ id: "c_ost", name: "Ostia", wikiPageTitle: null, externalSourceKey: null }],
    });
    await expect(caller.repairLinkage({ action: "auto_match", realm: "eurth" })).resolves.toEqual({
      repaired: 2,
    });
    const linked = db.mapLayer.updateMany.mock.calls.map((c) => c[0]);
    expect(linked.map((c) => c.where.featureId)).toEqual(["Ostia", "ostia_isles"]);
    expect(linked[0]).toEqual({
      where: {
        layerType: "political",
        isActive: true,
        realmId: EURTH,
        featureId: "Ostia",
        countryId: null,
      },
      data: { countryId: "c_ost" },
    });
    // One outline sync for the nation, after both regions are linked
    expect(syncCountryGeometryFromMapLayer).toHaveBeenCalledTimes(1);
    expect(syncCountryGeometryFromMapLayer).toHaveBeenCalledWith(db, "c_ost");
  });

  it("links reviewed matches, refusing nations of another realm", async () => {
    const { caller, db } = setup({
      regions: [],
      countries: [{ id: "c_ost", name: "Ostia", wikiPageTitle: null, externalSourceKey: null }],
    });
    await expect(
      caller.repairLinkage({
        action: "apply_matches",
        realm: "eurth",
        matches: [
          { featureId: "Ostai", countryId: "c_ost" },
          { featureId: "Elsewhere", countryId: "c_ixworld" },
        ],
      })
    ).resolves.toEqual({ repaired: 1 });
    expect(db.country.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["c_ost", "c_ixworld"] },
      realmId: EURTH,
    });
    expect(db.mapLayer.updateMany).toHaveBeenCalledTimes(1);
    expect(db.mapLayer.updateMany.mock.calls[0][0].where.featureId).toBe("Ostai");
  });
});
