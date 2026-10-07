/** @jest-environment node */
/**
 * Realms share one coordinate space, so every raw spatial join on map_layers must match the realm of the
 * country, subdivision or city it measures; otherwise IxWorld's climate, altitudes, rivers and lakes answer for
 * another realm's land.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/lib/country-geo/sync", () => ({
  syncGeographicDemographics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo", () => ({
  ...jest.requireActual("~/lib/country-geo"),
  upsertCity: jest.fn().mockResolvedValue({ id: "city", isNationalCapital: false }),
}));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import {
  updateCitySpatialProfile,
  updateSubdivisionSpatialProfile,
} from "~/lib/country-geo/spatial";
import { getTerrainAtPoint, getTerrainForArea } from "~/lib/country-geo/base-layer-query";
import {
  clipAndValidatePolygon,
  COUNTRY_BORDER_SQL,
  resetPostGISCache,
  snapPointToCountryBorder,
  validatePointContainment,
  validatePolygonContainment,
} from "~/lib/maps/geo-validation";
import { countryGeoRouter } from "~/server/api/routers/countryGeo";
import { geoAdminCitiesRouter } from "~/server/api/routers/geo/admin/cities";
import { geoFeaturesSubdivisionsGenerationRouter } from "~/server/api/routers/geo/features/subdivisions/generation";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const SQUARE = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

/** A db whose raw SQL answers `rows` (by default none) and records every statement. */
function sqlDb(rows: (sql: string) => unknown[] = () => []) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const $queryRawUnsafe = jest.fn(async (sql: string, ...params: unknown[]) => {
    statements.push({ sql, params });
    return rows(sql);
  });
  const model = () => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  });
  const db: Record<string, any> = {
    $queryRawUnsafe,
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    subdivision: model(),
    city: model(),
    country: model(),
    user: model(),
    realm: {
      findUnique: jest.fn(async (args: { where: { slug?: string; id?: string } }) =>
        args.where.slug === "eurth" || args.where.id === EURTH ? { id: EURTH } : null
      ),
    },
  };
  db.$transaction = (fn: (tx: unknown) => unknown) => fn(db);
  /** The statements that read map_layers. */
  const mapLayerSql = () => statements.filter((s) => /map_layers/.test(s.sql));
  return { db, statements, mapLayerSql };
}

/** The realm predicate of a statement that joins map_layers to the country being measured. */
const REALM_JOIN = /ml\."worldId" = co\."realmId"/;

beforeEach(() => {
  clearTrpcMemoryCache();
  resetPostGISCache();
});

describe("spatial profiles read only the country's realm", () => {
  it("a subdivision's climate, altitudes, rivers and lakes", async () => {
    const { db, mapLayerSql } = sqlDb();
    db.subdivision.findUnique.mockResolvedValue({ id: "s1", geometry: SQUARE, areaSqKm: 1 });
    await updateSubdivisionSpatialProfile(db, "s1");

    const sql = mapLayerSql();
    expect(sql.map((s) => s.sql.match(/"layerType" = '(\w+)'/)?.[1])).toEqual([
      "climate",
      "altitudes",
      "rivers",
      "lakes",
    ]);
    for (const { sql: text } of sql) {
      expect(text).toContain(`JOIN "Country" co ON co.id = s."countryId"`);
      expect(text).toMatch(REALM_JOIN);
    }
  });

  it("a city's climate and nearest water", async () => {
    const { db, mapLayerSql } = sqlDb();
    db.city.findUnique.mockResolvedValue({ id: "c1", coordinates: [0.5, 0.5] });
    await updateCitySpatialProfile(db, "c1");

    const sql = mapLayerSql();
    expect(sql).toHaveLength(2);
    for (const { sql: text } of sql) {
      expect(text).toContain(`JOIN "Country" co ON co.id = c."countryId"`);
      expect(text).toMatch(REALM_JOIN);
    }
  });
});

describe("terrain lookups take a realm", () => {
  it("getTerrainForArea filters both its altitude and climate queries", async () => {
    const { db, mapLayerSql } = sqlDb((sql) =>
      sql.includes("'altitudes'")
        ? [
            {
              zoneId: "z",
              zoneName: "Z",
              elevationMin: 0,
              elevationMax: 1,
              color: "#000",
              intersectArea: 1,
            },
          ]
        : []
    );
    await getTerrainForArea(db as unknown as PrismaClient, SQUARE, EURTH);

    const sql = mapLayerSql();
    expect(sql).toHaveLength(2);
    for (const { sql: text, params } of sql) {
      expect(text).toContain(`"worldId" = $2`);
      expect(params[1]).toBe(EURTH);
    }
  });

  it("getTerrainAtPoint filters by the realm it is given", async () => {
    const { db, mapLayerSql } = sqlDb();
    await getTerrainAtPoint(db as unknown as PrismaClient, 10, 20, EURTH);
    expect(mapLayerSql()[0]!.sql).toContain(`"worldId" = $3`);
    expect(mapLayerSql()[0]!.params).toEqual([10, 20, EURTH]);
  });

  it("countryGeo.sampleTerrainAt samples the viewed realm, or the viewer's own", async () => {
    const viewer = {
      id: "u1",
      clerkUserId: "clerk_u1",
      countryId: "c_eu",
      country: { id: "c_eu", name: "Eu", slug: "eu", realmId: EURTH },
    };
    const sample = async (realm?: string) => {
      const { db, mapLayerSql } = sqlDb();
      const caller = createCallerFactory(countryGeoRouter)(
        createMockRouterContext({ db, auth: { userId: "clerk_u1" }, user: viewer }) as never
      );
      await caller.sampleTerrainAt({ lng: 1, lat: 2, realm });
      return mapLayerSql()[0]!.params[2];
    };
    expect(await sample()).toBe(EURTH);
    expect(await sample("ixworld")).toBe(DEFAULT_REALM_ID);
  });
});

describe("a country's border is read from its own realm", () => {
  it("the shared border subquery matches the country's realm", () => {
    expect(COUNTRY_BORDER_SQL).toContain(`JOIN "Country" co ON co.id = ml."countryId"`);
    expect(COUNTRY_BORDER_SQL).toMatch(REALM_JOIN);
  });

  it.each([
    ["validatePointContainment", (db: PrismaClient) => validatePointContainment(db, "c1", 1, 1)],
    [
      "validatePolygonContainment",
      (db: PrismaClient) => validatePolygonContainment(db, "c1", SQUARE),
    ],
    ["clipAndValidatePolygon", (db: PrismaClient) => clipAndValidatePolygon(db, "c1", SQUARE)],
    ["snapPointToCountryBorder", (db: PrismaClient) => snapPointToCountryBorder(db, "c1", 1, 1)],
  ])("%s", async (_name, run) => {
    const { db, mapLayerSql } = sqlDb((sql) =>
      /PostGIS_Version/.test(sql)
        ? [{}]
        : [{ is_inside: true, clipped: JSON.stringify(SQUARE), distance_meters: 0 }]
    );
    await run(db as unknown as PrismaClient);
    expect(mapLayerSql().length).toBeGreaterThan(0);
    for (const { sql } of mapLayerSql()) expect(sql).toContain(COUNTRY_BORDER_SQL);
  });

  const owner = {
    id: "u_owner",
    clerkUserId: "owner_1",
    countryId: "c1",
    role: { name: "user", level: 100 },
    country: { id: "c1", name: "Aurelia", slug: "aurelia", realmId: EURTH },
  };
  const ownerCaller = <T>(router: T, db: unknown) =>
    createCallerFactory(router as never)(
      createMockRouterContext({ db, auth: { userId: "owner_1" }, user: owner }) as never
    ) as any;

  it("geoAdmin.commitCityImport checks each city against the realm's border", async () => {
    const { db, mapLayerSql } = sqlDb(() => [{ is_inside: true }]);
    db.user.findUnique.mockResolvedValue(owner);
    db.country.findUnique.mockResolvedValue({ id: "c1" });
    await ownerCaller(geoAdminCitiesRouter, db).commitCityImport({
      countryId: "c1",
      cities: [{ name: "Port", lng: 1, lat: 1 }],
    });
    expect(mapLayerSql()[0]!.sql).toContain(COUNTRY_BORDER_SQL);
  });

  it("geoFeatures.commitGeneratedSubdivisions reads the realm's border", async () => {
    const { db, mapLayerSql } = sqlDb(() => []);
    db.user.findUnique.mockResolvedValue(owner);
    await expect(
      ownerCaller(geoFeaturesSubdivisionsGenerationRouter, db).commitGeneratedSubdivisions({
        countryId: "c1",
        count: 3,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mapLayerSql()[0]!.sql).toContain(COUNTRY_BORDER_SQL);
  });
});
