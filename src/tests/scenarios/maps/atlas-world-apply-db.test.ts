/** @jest-environment node */
/**
 * Scenario, against real PostGIS (the `*_scenarios` scratch database): a founder's generated world is applied to a
 * fresh realm. What the in-memory fake cannot show: the writer's own PostGIS copy of every feature, valid; the
 * nations' outlines through atlas_country_union; their adjacency graph; the map version moved by the real SQL; and the
 * realm's rivers tile, whose seam-crossing rivers are split at ±180. Its rows are its own (prefix()) and go when it
 * ends. Then the version bump's own expression, as invalidateRealmMap sends it, evaluated by Postgres in a read-only
 * SELECT (the column replaced by a literal): one past the old version, never below the epoch second, so a database
 * restored to an older state jumps past every number its URLs, browsers and tile folders ever carried.
 *
 * Folds: src/tests/server/shared/map-version-sql.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: process.env.SCENARIOS_DATABASE_URL }) };
});
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import type { PrismaClient } from "@prisma/client";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { buildWorldBundle } from "~/lib/worldgen/world-apply";
import { saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { buildTile, sourceGeometry } from "~/server/modules/maps/tile-render";
import { rebuildAdjacency } from "~/lib/maps/adjacency";
import { applyWorld } from "~/server/modules/maps/world-import";
import { db as client } from "~/server/db";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { realWorld } from "~/tests/helpers/real-world-result";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";
import { RELIEF_ENTRY } from "~/tests/server/maps/world-import-fixtures";

jest.setTimeout(120_000);

const db = client as unknown as PrismaClient;

describeWithDb("a generated world applied to a realm on real PostGIS", () => {
  const p = prefix();
  const realmId = `${p}realm`;
  const founder = `${p}founder`;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "scenario-world-db-"));
    process.env.MAP_IMPORT_DIR = dir;
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await db.user.create({ data: { clerkUserId: founder } });
    await db.realm.create({
      data: {
        id: realmId,
        slug: realmId,
        name: "Scenario Eurth",
        ownerId: founder,
        status: "active",
      },
    });
  });
  afterAll(async () => {
    await db.mapLayer.deleteMany({ where: { realmId } });
    await db.mapImport.deleteMany({ where: { realmId } });
    await db.mapImportJob.deleteMany({ where: { realmId } });
    await db.country.deleteMany({ where: { realmId } });
    await db.realm.deleteMany({ where: { id: realmId } });
    await db.user.deleteMany({ where: { clerkUserId: founder } });
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
    delete process.env.MAP_IMPORT_DIR;
    jest.restoreAllMocks();
  });

  it("stores valid PostGIS copies, unions and joins every nation, moves the version and tiles the seam rivers apart", async () => {
    // Eurth at seed 4 on 8,000 cells, twelve nations: three rivers and three nations on the seam
    const draft = realWorld({
      params: {
        ...WORLD_PRESETS.eurth,
        countryCountRange: [12, 12],
        cellCount: 8000,
        plateCount: 8,
      },
      seed: 4,
    });
    const bundle = buildWorldBundle(draft, "preset");
    expect(bundle.layers.rivers.features.some((f) => f.geometry.type === "MultiLineString")).toBe(
      true
    );
    const uploadId = await saveMapUpload(gzipSync(JSON.stringify(bundle)));
    const check = await db.mapImportJob.create({
      data: {
        realmId,
        kind: "world",
        dryRun: true,
        status: "succeeded",
        requestedBy: founder,
        uploadId,
        result: { phase: "world-dry-run", mapVersion: 0 },
      },
    });

    const runRelief = jest.fn(async () => RELIEF_ENTRY);
    const result = await applyWorld(
      db,
      { id: `${p}apply`, realmId, uploadId, requestedBy: founder, parentJobId: check.id },
      undefined,
      { runRelief }
    );
    expect(result.rejected).toEqual([]);
    expect(result.slots.created).toBe(draft.slots.length);

    // Every active feature has the writer's PostGIS copy, and every copy is valid
    const [copies] = await db.$queryRawUnsafe<
      Array<{ total: number; missing: number; invalid: number }>
    >(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE geom_postgis IS NULL)::int AS missing,
              count(*) FILTER (WHERE geom_postgis IS NOT NULL AND NOT ST_IsValid(geom_postgis))::int AS invalid
         FROM map_layers WHERE "worldId" = $1 AND "isActive"`,
      realmId
    );
    expect(copies).toEqual({ total: expect.any(Number), missing: 0, invalid: 0 });
    expect(copies!.total).toBeGreaterThan(draft.slots.length);

    // Every nation has an outline: the PostGIS union of its regions, or (on the seam) its stored GeoJSON
    const nations = await db.country.findMany({ where: { realmId }, select: { id: true } });
    expect(nations).toHaveLength(draft.slots.length);
    for (const { id } of nations) {
      const [row] = await db.$queryRawUnsafe<
        Array<{ u: { geometry: unknown; wide: unknown[] | null } | null }>
      >(`SELECT atlas_country_union($1, $2) AS u`, id, realmId);
      expect(row!.u).not.toBeNull();
      expect(row!.u!.geometry !== null || (row!.u!.wide?.length ?? 0) > 0).toBe(true);
    }

    // The adjacency graph built from those copies: every nation touches another, and each says so of the other
    const adjacency = await rebuildAdjacency(db, realmId);
    expect(adjacency.pairs).toBeGreaterThan(0);
    const borders = await db.mapLayer.findMany({
      where: { realmId, layerType: "political", isActive: true },
      select: { featureId: true, neighbors: true },
    });
    const neighbours = new Map(
      borders.map((b) => [b.featureId, (b.neighbors as string[] | null) ?? []])
    );
    for (const [featureId, list] of neighbours) {
      for (const other of list) expect(neighbours.get(other)).toContain(featureId);
    }

    // The real version bump moved the realm past the check's version
    const realm = await db.realm.findUniqueOrThrow({
      where: { id: realmId },
      select: { mapVersion: true },
    });
    expect(realm.mapVersion).toBeGreaterThan(0);

    // The tiles split what crosses the seam: no river part is wider than half the world
    const [widest] = await db.$queryRawUnsafe<Array<{ widest: number }>>(
      `SELECT max(ST_XMax((d).geom) - ST_XMin((d).geom)) AS widest
         FROM (SELECT ST_Dump(${sourceGeometry("2")}) AS d FROM map_layers
                WHERE "worldId" = $1 AND "layerType" = 'rivers' AND "isActive") t`,
      realmId
    );
    expect(widest!.widest).toBeLessThanOrEqual(180);
    const tile = new VectorTile(new PbfReader(await buildTile(db, realmId, "rivers", 0, 0, 0)))
      .layers.rivers;
    expect(tile?.length).toBe(bundle.layers.rivers.features.length);
  });
});

describeWithDb("Realm.mapVersion's bump, evaluated by Postgres", () => {
  const pg = scenarioDb();
  afterAll(() => pg.$disconnect());

  /** What the statement invalidateRealmMap really sends sets the version to, from `old`, and the epoch second. */
  async function bumpFrom(old: number): Promise<{ next: number; epoch: number }> {
    const queryRaw = jest.fn().mockResolvedValue([{ mapVersion: 1 }]);
    await invalidateRealmMap({ $queryRaw: queryRaw } as never, "default");
    const sql = (queryRaw.mock.calls[0]![0] as string[]).join("?");
    const expression = /SET "mapVersion" = (.+) WHERE/.exec(sql)?.[1];
    if (!expression) throw new Error(`no version expression in: ${sql}`);
    const [row] = await pg.$queryRawUnsafe<Array<{ next: number; epoch: number }>>(
      `SELECT (${expression.replaceAll('"mapVersion"', String(old))})::int AS next,
              (extract(epoch from now()))::int AS epoch`
    );
    return row!;
  }

  it("jumps past the epoch second from a counter below it, as after a restore, and goes up by one above it", async () => {
    const restored = await bumpFrom(7);
    expect(restored.next).toBeGreaterThanOrEqual(restored.epoch);
    const ahead = restored.epoch + 1000;
    expect((await bumpFrom(ahead)).next).toBe(ahead + 1);
  });
});
