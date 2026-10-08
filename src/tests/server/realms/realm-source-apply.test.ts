/** @jest-environment node */
jest.mock("~/lib/maps/realm-map-writer", () => ({
  writeRealmMapFeatures: jest.fn(
    async (_db: unknown, _realm: string, features: Array<{ key: string }>) => ({
      written: features.map((f) => f.key),
      rejected: [],
      areas: Object.fromEntries(features.map((f) => [f.key, 1234])),
    })
  ),
}));
jest.mock("~/lib/maps/realm-layer-repair", () => ({
  repairRealmLayer: jest.fn().mockResolvedValue({
    plan: { smoothing: { status: "smooth" } },
    written: { written: ["A"], smoothed: 1, rejected: [] },
    mapImportId: "imp1",
  }),
}));
jest.mock("~/lib/maps/adjacency", () => ({
  rebuildAdjacency: jest.fn().mockResolvedValue({ skipped: true }),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import { repairRealmLayer } from "~/lib/maps/realm-layer-repair";
import type { PlannedNation, SyncPlan } from "~/lib/realms/sources/plan";
import { applySyncPlan } from "~/server/modules/realms/realms.source-apply";
import { IXSTATS_NATION_GROWTH_DEFAULTS } from "~/lib/realms/nation-growth-defaults";

const ctx = {
  realmId: "eurth-id",
  realmSlug: "eurth",
  wikiSource: "iiwiki",
  attribution: "Map: test",
  areaScale: 1,
};

function emptyPlan(over: Partial<SyncPlan> = {}): SyncPlan {
  return {
    creates: [],
    updates: [],
    skippedClaimed: [],
    locked: [],
    features: [],
    featuresUnchanged: 0,
    alliances: [],
    unknownMembers: [],
    missing: [],
    unmatched: [],
    excluded: [],
    warnings: [],
    counts: {
      sourceNations: 0,
      matched: 0,
      create: 0,
      update: 0,
      features: 0,
      alliances: 0,
      unmatched: 0,
      missing: 0,
    },
    refills: [],
    ...over,
  };
}

const planned = (name: string, over: Partial<PlannedNation> = {}): PlannedNation => ({
  name,
  key: name,
  from: "source",
  wikiTitle: name,
  officialName: `Republic of ${name}`,
  capital: `${name} City`,
  population: 2_000_000,
  gdpPerCapita: 30_000,
  landArea: 40_000,
  continent: "Europa",
  readInfobox: true,
  ...over,
});

function applyDb() {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    country: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }: any) => ({ id: `id-${data.name}` })),
      update: jest.fn().mockResolvedValue({}),
    },
    nationalIdentity: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    alliance: {
      create: jest.fn(async ({ data }: any) => ({ id: "al-new", realmId: data.realmId })),
      update: jest.fn(async () => ({ id: "al-old", realmId: "eurth-id" })),
    },
    allianceMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(2),
    },
  };
  return db;
}

describe("applySyncPlan", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates unclaimed nations with the baseline, source key, wiki page and identity; map figures win over the infobox", async () => {
    const db = applyDb();
    const fetchInfobox = jest.fn().mockResolvedValue({
      country: { baselinePopulation: 7, flag: "https://img/flag.png" },
      identity: { motto: "Onward", capitalCity: "Wiki City" },
    });
    const sleep = jest.fn().mockResolvedValue(undefined);
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        creates: [planned("Tavok"), planned("Mapland", { wikiTitle: null, readInfobox: false })],
      }),
      { fetchInfobox, sleep, wikiDelayMs: 5 }
    );
    expect(result.created).toBe(2);
    const tavok = db.country.create.mock.calls[0][0].data;
    expect(tavok).toMatchObject({
      name: "Tavok",
      slug: "tavok",
      realmId: "eurth-id",
      externalSourceKey: "Tavok",
      wikiSource: "iiwiki",
      wikiPageTitle: "Tavok",
      baselinePopulation: 2_000_000,
      baselineGdpPerCapita: 30_000,
      landArea: 40_000,
      continent: "Europa",
      flag: "https://img/flag.png",
      nationalIdentity: {
        create: {
          countryName: "Tavok",
          officialName: "Republic of Tavok",
          capitalCity: "Tavok City",
          motto: "Onward",
        },
      },
    });
    expect(tavok).not.toHaveProperty("ownerUserId");
    expect(tavok.currentPopulation).toBeGreaterThan(0);
    // A nation only on the map: no wiki page, so its claim always goes to manual review.
    expect(db.country.create.mock.calls[1][0].data).toMatchObject({
      wikiSource: null,
      wikiPageTitle: null,
    });
    expect(fetchInfobox).toHaveBeenCalledTimes(1);
  });

  it("gives created nations the realm's growth for their tier, else IxStats's defaults", async () => {
    const realmTable = {
      ...IXSTATS_NATION_GROWTH_DEFAULTS,
      Developed: { populationGrowthRate: 0.012, adjustedGdpGrowth: 0.002 },
    };
    const db = applyDb();
    const plan = emptyPlan({ creates: [planned("Tavok", { readInfobox: false })] }); // $30,000: Developed
    await applySyncPlan(db, { ...ctx, nationDefaults: realmTable }, plan, {});
    expect(db.country.create.mock.calls[0][0].data).toMatchObject({
      populationGrowthRate: 0.012,
      adjustedGdpGrowth: 0.002,
      maxGdpGrowthRate: 0.05,
    });
    const plain = applyDb();
    await applySyncPlan(plain, ctx, plan, {});
    expect(plain.country.create.mock.calls[0][0].data).toMatchObject(
      IXSTATS_NATION_GROWTH_DEFAULTS.Developed
    );
  });

  it("reads infoboxes one at a time with a pause between, and lists the ones that gave nothing", async () => {
    const db = applyDb();
    const calls: string[] = [];
    const fetchInfobox = jest.fn(async (_s: string, title: string) => {
      calls.push(`read:${title}`);
      return { country: {}, identity: {} };
    });
    const sleep = jest.fn(async () => void calls.push("pause"));
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({ creates: [planned("A"), planned("B")] }),
      {
        fetchInfobox,
        sleep,
      }
    );
    expect(calls).toEqual(["read:A", "pause", "read:B"]);
    expect(result.infoboxEmpty).toEqual(["A", "B"]);
    expect(result.created).toBe(2);
  });

  it("re-reads the infobox of nations it never reached, paced with the creates, filling only what is empty", async () => {
    const db = applyDb();
    db.country.findFirst = jest.fn().mockResolvedValue({ id: "r1" });
    db.country.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === "r1"
        ? {
            name: "Retry",
            flag: null,
            coatOfArms: "",
            leader: "Kept Leader",
            governmentType: null,
            nationalIdentity: { capitalCity: "Kept City", motto: null },
          }
        : null
    );
    const calls: string[] = [];
    const fetchInfobox = jest.fn(async (_s: string, title: string) => {
      calls.push(`read:${title}`);
      return title === "Retry"
        ? {
            country: {
              flag: "https://img/flag.png",
              leader: "Wiki Leader",
              government: "Republic",
            },
            identity: { capitalCity: "Wiki City", motto: "Onward" },
          }
        : { country: {}, identity: {} };
    });
    const sleep = jest.fn(async () => void calls.push("pause"));
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        creates: [planned("New")],
        refills: [
          { countryId: "r1", name: "Retry", wikiTitle: "Retry" },
          { countryId: "r2", name: "Still Empty", wikiTitle: "Still Empty" },
        ],
      }),
      { fetchInfobox, sleep }
    );
    expect(calls).toEqual(["read:New", "pause", "read:Retry", "pause", "read:Still Empty"]);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { flag: "https://img/flag.png", governmentType: "Republic" },
    });
    expect(db.nationalIdentity.update).toHaveBeenCalledWith({
      where: { countryId: "r1" },
      data: { motto: "Onward" },
    });
    expect(result.refilled).toEqual(["Retry"]);
    expect(result.infoboxEmpty).toEqual(["New", "Still Empty"]);
  });

  it("leaves a nation claimed since the plan alone when re-reading infoboxes, and reads nothing without a reader", async () => {
    const db = applyDb();
    db.country.findFirst = jest.fn().mockResolvedValue(null);
    const fetchInfobox = jest.fn().mockResolvedValue({ country: { flag: "f" }, identity: {} });
    const plan = emptyPlan({ refills: [{ countryId: "r1", name: "Taken", wikiTitle: "Taken" }] });
    const result = await applySyncPlan(db, ctx, plan, { fetchInfobox });
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1", realmId: "eurth-id", ownerUserId: null } })
    );
    expect(db.country.update).not.toHaveBeenCalled();
    expect(result.refilled).toEqual([]);
    const without = await applySyncPlan(applyDb(), ctx, plan, {});
    expect(without.refilled).toEqual([]);
  });

  it("records a failed create and carries on", async () => {
    const db = applyDb();
    db.country.create
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "id-B" });
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({ creates: [planned("A"), planned("B")] })
    );
    expect(result.created).toBe(1);
    expect(result.errors).toEqual(["Create A: boom"]);
  });

  it("leaves a nation claimed since the plan was made with its own figures", async () => {
    const db = applyDb();
    db.country.findUnique.mockResolvedValue({
      name: "Free",
      ownerUserId: "u-new-owner",
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      landArea: 1,
      continent: null,
    });
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        updates: [
          {
            countryId: "f",
            name: "Free",
            key: "Free",
            claimed: false,
            bindKey: false,
            changes: [{ field: "population", from: 1, to: 5 }],
          },
        ],
      })
    );
    expect(db.country.update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it("updates an unclaimed nation's figures through the baseline and its identity", async () => {
    const db = applyDb();
    db.country.findUnique.mockResolvedValue({
      name: "Free",
      ownerUserId: null,
      baselinePopulation: 1_000_000,
      baselineGdpPerCapita: 10_000,
      landArea: 10_000,
      continent: null,
    });
    await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        updates: [
          {
            countryId: "f",
            name: "Free",
            key: "Free",
            claimed: false,
            bindKey: true,
            changes: [
              { field: "population", from: 1_000_000, to: 3_000_000 },
              { field: "capital", from: null, to: "Freeport" },
            ],
          },
        ],
      })
    );
    const data = db.country.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ baselinePopulation: 3_000_000, externalSourceKey: "Free" });
    expect(data.currentPopulation).toBeGreaterThan(0);
    expect(db.nationalIdentity.upsert.mock.calls[0][0].update).toEqual({ capitalCity: "Freeport" });
  });

  it("writes borders through the realm map writer and sets the traced area only for nations with no stated area", async () => {
    const db = applyDb();
    db.country.findMany.mockResolvedValue([{ id: "c1", name: "Deseti" }]);
    const square = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
    };
    await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        features: [
          {
            key: "Deseti",
            nation: { countryId: "c1" },
            geometry: square,
            areaKm2: 6895,
            sourceHash: "h",
            fill: "#a547a5",
            action: "create",
            setLandArea: true,
          },
          {
            key: "Stated",
            nation: { countryId: "c2" },
            geometry: square,
            areaKm2: 99,
            sourceHash: "h",
            fill: null,
            action: "create",
            setLandArea: false,
          },
        ],
      })
    );
    const [, realmId, features, options] = (writeRealmMapFeatures as jest.Mock).mock.calls[0];
    expect(realmId).toBe("eurth-id");
    expect(options).toEqual({ layerType: "political", areaScale: 1 });
    expect(features[0]).toMatchObject({
      key: "Deseti",
      name: "Deseti",
      countryId: "c1",
      properties: { attribution: "Map: test", fill: "#a547a5" },
    });
    // No source colour: no fill, so the map's default colouring applies (as on IxWorld)
    expect(features[1].properties).not.toHaveProperty("fill");
    expect(db.country.update).toHaveBeenCalledTimes(1);
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { landArea: 6895, areaSqMi: expect.any(Number) },
    });
  });

  it("measures borders on the realm's own planet", async () => {
    const db = applyDb();
    const square = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
    };
    await applySyncPlan(
      db,
      { ...ctx, areaScale: 0.25 },
      emptyPlan({
        features: [
          {
            key: "A",
            nation: null,
            geometry: square,
            areaKm2: null,
            sourceHash: "h",
            fill: null,
            action: "create",
            setLandArea: false,
          },
        ],
      })
    );
    expect((writeRealmMapFeatures as jest.Mock).mock.calls[0][3]).toEqual({
      layerType: "political",
      areaScale: 0.25,
    });
  });

  describe("with the realm's border smoothing (pipeline coverage)", () => {
    const square = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      ],
    };
    const feature = {
      key: "A",
      nation: null,
      geometry: square,
      areaKm2: null,
      sourceHash: "h",
      fill: null,
      action: "update" as const,
      setLandArea: false,
    };
    const sourceRaw = new Map([["A", { geometry: square, sourceHash: "h" }]]);
    const smoothing = { coverage: { tolerance: 0.045, smooth: 2 }, sourceRaw };

    beforeEach(() => (repairRealmLayer as jest.Mock).mockClear());

    it("smooths the layer after writing its borders raw, from the source's outlines, before adjacency", async () => {
      const db = applyDb();
      await applySyncPlan(
        db,
        { ...ctx, areaScale: 0.25, borderSmoothing: smoothing },
        emptyPlan({ features: [feature] })
      );
      expect((writeRealmMapFeatures as jest.Mock).mock.calls.at(-1)[3]).toEqual({
        layerType: "political",
        areaScale: 0.25,
      });
      expect(repairRealmLayer).toHaveBeenCalledWith(db, "eurth-id", {
        layerType: "political",
        coverage: { tolerance: 0.045, smooth: 2 },
        apply: true,
        createdBy: "source-sync",
        areaScale: 0.25,
        sourceRaw,
      });
    });

    it("does not smooth when the run wrote no border", async () => {
      await applySyncPlan(applyDb(), { ...ctx, borderSmoothing: smoothing }, emptyPlan());
      expect(repairRealmLayer).not.toHaveBeenCalled();
    });

    it("records a failed smoothing and carries on", async () => {
      (repairRealmLayer as jest.Mock).mockRejectedValueOnce(new Error("no PostGIS"));
      const result = await applySyncPlan(
        applyDb(),
        { ...ctx, borderSmoothing: smoothing },
        emptyPlan({ features: [feature] })
      );
      expect(result.errors).toContain("Border smoothing: no PostGIS");
    });
  });

  it("creates realm alliances, adds members once, and never pulls back a nation that left", async () => {
    const db = applyDb();
    db.allianceMember.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "m", isActive: false, status: "left" });
    db.country.findUnique.mockResolvedValue({ realmId: "eurth-id" });
    const result = await applySyncPlan(
      db,
      ctx,
      emptyPlan({
        alliances: [
          {
            key: "pact",
            allianceId: null,
            name: "Some Pact",
            shortName: "SP",
            color: "#ff0000",
            type: "military",
            changes: [],
            addMembers: [
              { nation: { countryId: "a" }, name: "A" },
              { nation: { countryId: "b" }, name: "B" },
            ],
            notInSource: [],
          },
        ],
      })
    );
    expect(db.alliance.create.mock.calls[0][0].data).toMatchObject({
      realmId: "eurth-id",
      externalSourceKey: "pact",
      name: "Some Pact",
      shortName: "SP",
      type: "military",
      color: "#ff0000",
    });
    expect(db.allianceMember.create).toHaveBeenCalledTimes(1);
    expect(db.allianceMember.create.mock.calls[0][0].data).toMatchObject({
      countryId: "a",
      status: "active",
      isActive: true,
    });
    expect(result).toMatchObject({ alliancesCreated: 1, membersAdded: 1 });
  });
});
