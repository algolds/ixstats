/** @jest-environment node */
/**
 * A realm's planet radius (`Realm.settings.map.radiusKm`) scales the areas its map editors store and the
 * "Recompute areas" action, which never touches nations' stated land area unless the founder asks.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual("~/lib/maps/geo-validation"),
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));

import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { EARTH_RADIUS_KM, polygonalAreaSqKm } from "~/lib/maps/planet";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const FOUNDER = "clerk_founder";
const MAP_OFFICER = "clerk_mapper";
const HALF_EARTH = EARTH_RADIUS_KM / 2;

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock> & Record<`$${string}`, jest.Mock>;

function realmDb(radiusKm?: number): Db {
  const models = new Map<string, ModelMock>();
  const raw: Record<string, jest.Mock> = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
  const db = new Proxy({} as Db, {
    get: (_t, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
      if (key.startsWith("$")) return raw[key];
      if (!models.has(key)) {
        models.set(key, {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          groupBy: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({ id: "created" }),
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        });
      }
      return models.get(key);
    },
  });
  const realm = {
    id: EURTH,
    slug: "eurth",
    name: "Eurth",
    ownerId: FOUNDER,
    status: "active",
    settings: radiusKm ? { map: { radiusKm } } : {},
    officers: [{ userId: MAP_OFFICER, powers: ["map"] }],
  };
  db.realm!.findUnique!.mockImplementation(
    async ({ where }: { where: { slug?: string; id?: string } }) =>
      where.slug === "eurth" || where.id === EURTH ? realm : null
  );
  return db;
}

function ctxAs(db: Db, clerkUserId: string) {
  return createMockRouterContext({
    db,
    auth: { userId: clerkUserId },
    user: { id: `db_${clerkUserId}`, clerkUserId, role: null, country: null },
    rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
  }) as never;
}

const SQUARE = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
};

async function splitAreas(radiusKm?: number) {
  const db = realmDb(radiusKm);
  db.mapLayer!.findFirst!.mockResolvedValue({
    id: "ml1",
    featureId: "Big",
    countryId: null,
    geometry: SQUARE,
  });
  await createCallerFactory(geoEditorBordersRouter)(ctxAs(db, MAP_OFFICER)).splitCountry({
    featureId: "Big",
    splitLine: [
      [2, -1],
      [2, 5],
    ],
    nameA: "West",
    nameB: "East",
    realm: "eurth",
  });
  const rows = db.mapLayer!.createMany!.mock.calls[0][0].data as Array<{ areaSqKm: number }>;
  return rows.map((r) => r.areaSqKm);
}

describe("the border editor stores areas on the realm's planet", () => {
  it("a planet of half Earth's radius stores a quarter of the area", async () => {
    const earth = await splitAreas();
    const small = await splitAreas(HALF_EARTH);
    expect(earth).toHaveLength(2);
    small.forEach((area, i) => expect(area).toBeCloseTo(earth[i]! / 4, 6));
  });
});

describe("Recompute areas", () => {
  const recompute = (db: Db, who: string, alsoSetLandArea = false) =>
    createCallerFactory(realmMapRouter)(ctxAs(db, who)).recomputeAreas({
      realm: "eurth",
      alsoSetLandArea,
    });

  it("re-measures the realm's polygon features with PostGIS × (r / 6371)²", async () => {
    const db = realmDb(HALF_EARTH);
    db.$queryRawUnsafe!.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(recompute(db, MAP_OFFICER)).resolves.toMatchObject({
      radiusKm: HALF_EARTH,
      updated: 2,
      countriesUpdated: 0,
    });
    const [sql, realmId, factor] = db.$queryRawUnsafe!.mock.calls[0];
    expect(sql).toContain("ST_Area(geom_postgis::geography)");
    expect(sql).toContain(`"worldId" = $1`);
    expect(realmId).toBe(EURTH);
    expect(factor).toBeCloseTo(0.25);
  });

  it("leaves nations' stated land area alone unless the founder ticks the box", async () => {
    const db = realmDb();
    await recompute(db, MAP_OFFICER);
    expect(db.country!.updateMany).not.toHaveBeenCalled();
    expect(db.country!.update).not.toHaveBeenCalled();
  });

  it("only the founder (or staff) sets nations' land area from the map", async () => {
    const db = realmDb();
    await expect(recompute(db, MAP_OFFICER, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("with the box ticked, a nation's land area becomes the sum of its regions", async () => {
    const db = realmDb();
    db.mapLayer!.groupBy!.mockResolvedValue([{ countryId: "c1", _sum: { areaSqKm: 1500 } }]);
    await expect(recompute(db, FOUNDER, true)).resolves.toMatchObject({ countriesUpdated: 1 });
    expect(db.country!.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", realmId: EURTH },
      data: { landArea: 1500, areaSqMi: 1500 * 0.386102 },
    });
  });

  it("without PostGIS, measures each polygon here on the realm's planet", async () => {
    (isPostGISAvailable as jest.Mock).mockResolvedValueOnce(false);
    const db = realmDb(HALF_EARTH);
    db.mapLayer!.findMany!.mockResolvedValueOnce([
      { id: "a", geometry: SQUARE },
      { id: "b", geometry: { type: "LineString", coordinates: [] } },
    ]);
    await expect(recompute(db, MAP_OFFICER)).resolves.toMatchObject({ updated: 1 });
    expect(db.mapLayer!.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { areaSqKm: polygonalAreaSqKm(SQUARE, HALF_EARTH) },
    });
    expect(db.mapLayer!.findMany!.mock.calls[0][0].where).toMatchObject({ realmId: EURTH });
  });

  it("a player who is neither founder nor map officer cannot recompute", async () => {
    const db = realmDb();
    await expect(recompute(db, "clerk_player")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("map settings", () => {
  it("a map officer saves the default view and attribution; other settings are kept", async () => {
    const db = realmDb(8000);
    await createCallerFactory(realmMapRouter)(ctxAs(db, MAP_OFFICER)).updateSettings({
      realm: "eurth",
      defaultView: { center: [12, 34], zoom: 3.5 },
      attribution: "Map: the Eurth community",
    });
    expect(db.realm!.update).toHaveBeenCalledWith({
      where: { id: EURTH },
      data: {
        settings: {
          map: {
            radiusKm: 8000,
            defaultView: { center: [12, 34], zoom: 3.5 },
            attribution: "Map: the Eurth community",
          },
        },
      },
    });
  });

  it("refuses a base image that is neither https nor an upload", async () => {
    const db = realmDb();
    await expect(
      createCallerFactory(realmMapRouter)(ctxAs(db, FOUNDER)).updateSettings({
        realm: "eurth",
        baseImage: "http://example.org/map.png",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm!.update).not.toHaveBeenCalled();
  });
});

describe("what the realm's map viewer shows", () => {
  const display = (db: Db, who: string) =>
    createCallerFactory(realmMapRouter)(ctxAs(db, who)).display({ realm: "eurth" });

  it("falls back to the source sync's attribution when the realm sets none", async () => {
    const db = realmDb();
    db.realmSourceSync!.findUnique!.mockResolvedValue({
      settings: { attribution: "Borders: Eurth map project" },
    });
    await expect(display(db, "clerk_player")).resolves.toMatchObject({
      realmId: EURTH,
      isIxWorld: false,
      radiusKm: EARTH_RADIUS_KM,
      attribution: "Borders: Eurth map project",
      canEdit: false,
      isFounder: false,
    });
  });

  it("prefers the realm's own credit line, and lists its unclaimed nations", async () => {
    const db = realmDb(HALF_EARTH);
    db.realm!.findUnique!.mockImplementation(async () => ({
      id: EURTH,
      slug: "eurth",
      name: "Eurth",
      ownerId: FOUNDER,
      status: "active",
      settings: {
        map: {
          radiusKm: HALF_EARTH,
          attribution: "Map: Eurth",
          baseImage: "/images/uploads/uploaded_eurth.png",
        },
      },
      officers: [{ userId: MAP_OFFICER, powers: ["map"] }],
    }));
    db.country!.findMany!.mockResolvedValue([{ id: "c_open" }]);
    const result = await display(db, MAP_OFFICER);
    expect(result).toMatchObject({
      radiusKm: HALF_EARTH,
      attribution: "Map: Eurth",
      baseImage: "/images/uploads/uploaded_eurth.png",
      unclaimedCountryIds: ["c_open"],
      canEdit: true,
      isFounder: false,
    });
    expect(db.realmSourceSync!.findUnique).not.toHaveBeenCalled();
    expect(db.country!.findMany!.mock.calls[0][0].where).toEqual({
      realmId: EURTH,
      ownerUserId: null,
      isDemo: false,
    });
  });
});
