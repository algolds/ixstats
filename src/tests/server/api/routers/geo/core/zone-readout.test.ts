/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { pointQueryProcedures } from "~/server/api/routers/geo/core/point-queries";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";
import {
  buildClimateZones,
  buildElevationZones,
} from "~/server/api/routers/geo/core/profile-zones";
import { climateMetadataType, getAgricultureFactor } from "~/lib/maps/geo-analytics";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";

const EURTH = "r_eurth";
const KOPPEN: ClimateKey = {
  system: "Köppen",
  zones: [
    { code: "Af", name: "Tropical Rainforest", color: "#0037ff" },
    { code: "Cfb", name: "Oceanic", color: "#21c200" },
    { code: "EF", name: "Ice Cap", color: "#686868" },
  ],
};
const LAND_BAND = { fill: "#a8c995", zoneId: "land", zoneName: "Land" };

type Mock = jest.Mock;

/** A db whose realms are IxWorld and Eurth (with the Köppen key), and whose raw SQL answers `rows`. */
function fakeDb(rows: (sql: string) => unknown[]) {
  const settings = { map: { climateKey: KOPPEN } };
  const db = {
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.slug === "eurth" || where.id === EURTH) return { id: EURTH, settings };
        if (where.id === DEFAULT_REALM_ID) return { id: DEFAULT_REALM_ID, settings: {} };
        return null;
      }),
    },
    country: { findUnique: jest.fn(), findFirst: jest.fn() },
    mapLayer: { findMany: jest.fn(async () => []) },
    peak: { findFirst: jest.fn(async () => null) },
    namedRiver: { findFirst: jest.fn(async () => null) },
    namedLake: { findFirst: jest.fn(async () => null) },
    city: { findFirst: jest.fn(async () => null) },
    $queryRawUnsafe: jest.fn(async (sql: string) => rows(sql)),
    $executeRawUnsafe: jest.fn(async () => 0),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  return db;
}

const ctxFor = (db: ReturnType<typeof fakeDb>) =>
  ({ db, user: null, auth: null, rateLimitIdentifier: "test", headers: new Headers() }) as never;

const caller = createCallerFactory(
  createTRPCRouter({ ...pointQueryProcedures, ...geoProfileProcedures })
);

beforeEach(() => clearTrpcMemoryCache());

describe("climate and elevation zones of a country", () => {
  it("names a realm's zones through its climate key, merged per zone, with the key's colour", () => {
    const zones = buildClimateZones(
      [
        { fill: "#21c200", climateId: "Cfb", overlapArea: 30 },
        { fill: "#0037ff", climateId: "Af", overlapArea: 10 },
        { fill: "#21c200", climateId: "Cfb", overlapArea: 10 },
      ],
      true,
      KOPPEN
    );
    expect(zones).toEqual([
      {
        type: "Temperate Oceanic (Do)",
        code: "Cfb",
        name: "Oceanic",
        color: "#21c200",
        areaSqKm: 40,
        percentArea: 80,
        agricultureFactor: getAgricultureFactor("Temperate Oceanic (Do)"),
      },
      {
        type: "Tropical Wet (Ar)",
        code: "Af",
        name: "Tropical Rainforest",
        color: "#0037ff",
        areaSqKm: 10,
        percentArea: 20,
        agricultureFactor: getAgricultureFactor("Tropical Wet (Ar)"),
      },
    ]);
  });

  it("keeps IxWorld's Trewartha colours when the realm has no key", () => {
    const [zone] = buildClimateZones([{ fill: "#00fd97", overlapArea: 5 }], true, null);
    expect(zone).toMatchObject({ type: "Temperate Oceanic (Do)", percentArea: 100 });
    expect(zone).not.toHaveProperty("code");
  });

  it("counts no elevation for a land-only band, but IxWorld's bands as before", () => {
    expect(buildElevationZones([{ ...LAND_BAND, overlapArea: 50 }])).toEqual([]);
    expect(buildElevationZones([{ fill: "#a8c995", overlapArea: 50 }])).toMatchObject([
      { zone: "zone_0", percentArea: 100 },
    ]);
  });

  it("maps Köppen codes to the nearest Trewartha type and keeps Trewartha codes", () => {
    expect(
      ["Af", "Aw/As", "BWh", "BSk", "Csb", "Cwa", "Cfb", "Dfa", "Dfc", "ET", "EF", "Do"].map(
        climateMetadataType
      )
    ).toEqual([
      "Tropical Wet (Ar)",
      "Tropical Wet-And-Dry (Aw)",
      "Desert or Arid (Bw)",
      "Steppe or Semiarid (Bs)",
      "Subtropical Dry Summer (Cs)",
      "Subtropical Humid (Cf)",
      "Temperate Oceanic (Do)",
      "Temperate Continental (Dc)",
      "Boreal (E)",
      "Tundra (Ft)",
      "Ice Cap (Fi)",
      "Temperate Oceanic (Do)",
    ]);
    expect(climateMetadataType("Zz")).toBeNull();
  });
});

describe("the pin tool's zone readout", () => {
  const layersAt = (rows: Array<{ layerType: string; properties: Record<string, unknown> }>) =>
    fakeDb((sql) =>
      sql.includes("FROM map_layers")
        ? rows.map((r) => ({ featureId: "f", displayName: null, countryId: null, ...r }))
        : []
    );

  it("names the climate zone through the realm's key and says Land for a land-only band", async () => {
    const db = layersAt([
      { layerType: "climate", properties: { fill: "#21c200", climateId: "Cfb" } },
      { layerType: "altitudes", properties: LAND_BAND },
    ]);
    const info = await caller(ctxFor(db)).getPointInfo({ lng: 1, lat: 2, realm: "eurth" });
    expect(info.climate).toEqual({
      climateId: "Cfb",
      climateName: "Cfb: Oceanic",
      color: "#21c200",
    });
    expect(info.elevation).toEqual({
      zoneId: "land",
      zoneName: "Land",
      elevationMin: null,
      elevationMax: null,
      elevationLabel: null,
      color: "#a8c995",
    });
  });

  it("finds the zone by its colour when the feature has no code", async () => {
    const db = layersAt([{ layerType: "climate", properties: { fill: "#686868" } }]);
    const info = await caller(ctxFor(db)).getPointInfo({ lng: 1, lat: -80, realm: "eurth" });
    expect(info.climate?.climateName).toBe("EF: Ice Cap");
  });

  it("keeps IxWorld's Trewartha names and elevation bands", async () => {
    const db = layersAt([
      { layerType: "climate", properties: { fill: "#00fd97" } },
      { layerType: "altitudes", properties: { fill: "#c3d3a1" } },
    ]);
    const info = await caller(ctxFor(db)).getPointInfo({ lng: 1, lat: 2 });
    expect(info.climate?.climateName).toBe("Do: Temperate Oceanic");
    expect(info.elevation).toMatchObject({ zoneName: "Low Hills", elevationLabel: "100-349m" });
  });
});

describe("the Geography tab of a realm nation", () => {
  it("clips the realm's own climate and altitude layers to the nation and names zones by the key", async () => {
    const db = fakeDb((sql) => {
      if (!sql.includes("ST_Intersection(ml.geom_postgis")) return [];
      return sql.includes("climateId")
        ? [
            { fill: "#21c200", climateId: "Cfb", zoneId: null, area: 300 },
            { fill: "#686868", climateId: "EF", zoneId: null, area: 100 },
          ]
        : [{ fill: "#a8c995", climateId: null, zoneId: "land", area: 400 }];
    });
    db.country.findUnique.mockResolvedValue({
      id: "c_eu",
      name: "Gallambria",
      realmId: EURTH,
      geometry: { type: "Point", coordinates: [0, 0] },
      centroid: [0, 50],
      boundingBox: [0, 49, 1, 51],
      coastlineKm: null,
      landArea: 400,
      areaSqMi: null,
    });
    const profile = await caller(ctxFor(db)).getCountryGeoProfile({ countryId: "c_eu" });

    expect(profile.climate.zones.map((z) => [z.code, z.name, z.percentArea])).toEqual([
      ["Cfb", "Oceanic", 75],
      ["EF", "Ice Cap", 25],
    ]);
    expect(profile.elevation.zones).toEqual([]);
    const clipSql = (db.$queryRawUnsafe as Mock).mock.calls
      .map((c: [string, ...unknown[]]) => c)
      .filter(([sql]) => sql.includes("ST_Intersection(ml.geom_postgis"));
    expect(clipSql.map(([, , layerType]) => layerType).sort()).toEqual(["altitudes", "climate"]);
    for (const [sql] of clipSql) expect(sql).toContain(`ml."worldId" = c."realmId"`);
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });
});
