/** @jest-environment node */
/**
 * Ixnay's vector tiles against the clone database (real map data, read-only SQL): `buildTile`'s PostGIS output (size,
 * colour merge, winding, and shapes crossing ±180 split as the GeoJSON path splits them, drawn without the slivers
 * `geom_postgis` repair left), and the tile route end to end (real realm lookup, version read and PostGIS tiles; the
 * tile cache is a temp folder) on the antimeridian tiles. Runs only with TILES_DB_URL set.
 *
 * Folds: src/tests/app/api/map-tiles/route-db.test.ts
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import type { Geometry, Position } from "geojson";
import { NextRequest } from "next/server";

const url = process.env.TILES_DB_URL;
const run = url ? describe : describe.skip;

// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("@clerk/nextjs/server", () => ({ auth: () => Promise.resolve({ userId: null }) }));
jest.mock("~/server/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: process.env.TILES_DB_URL }) };
});

import { db as client } from "~/server/db";
import { GET } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";
import { splitCollectionAtAntimeridian } from "~/lib/maps/map-utils";
import { buildTile, sourceGeometry } from "~/server/modules/maps/tile-render";

const db = client as unknown as PrismaClient;

const decode = (bytes: Uint8Array, layer: string) =>
  new VectorTile(new PbfReader(bytes)).layers[layer];

run("Ixnay's tiles against the clone DB", () => {
  afterAll(() => db.$disconnect());

  describe("buildTile", () => {
    it("builds the whole-world altitudes tile under 150 KB, poles included, merged by colour", async () => {
      const bytes = await buildTile(db, "default", "altitudes", 0, 0, 0);
      expect(bytes.length).toBeLessThan(150 * 1024);
      const tile = decode(bytes, "altitudes");
      expect(tile?.length).toBeGreaterThan(0);
      const colours = Array.from(
        { length: tile!.length },
        (_, i) => tile!.feature(i).properties._fillColor
      );
      expect(new Set(colours).size).toBe(colours.length);
    });

    it("keeps the whole-world rivers tile under 150 KB (simplified to half a pixel)", async () => {
      expect((await buildTile(db, "default", "rivers", 0, 0, 0)).length).toBeLessThan(150 * 1024);
    });

    it("splits altitudes shapes that cross the antimeridian instead of stretching them across the world", async () => {
      const [row] = await db.$queryRawUnsafe<Array<{ widest: number }>>(
        `SELECT max(ST_XMax((d).geom) - ST_XMin((d).geom)) AS widest
         FROM (SELECT ST_Dump(${sourceGeometry("3")}) AS d FROM map_layers
               WHERE "worldId" = 'default' AND "layerType" = $1 AND "isActive") t`,
        "altitudes"
      );
      expect(row!.widest).toBeLessThanOrEqual(180);
    });

    it("splits antimeridian altitudes exactly as the GeoJSON path does (same area per shape)", async () => {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; stored: string; tiled: number }>>(
        `SELECT "featureId" AS id, geometry::text AS stored, ST_Area(${sourceGeometry("3")}) AS tiled
         FROM map_layers WHERE "worldId" = 'default' AND "layerType" = 'altitudes' AND "isActive"
           AND ST_XMax(geom_postgis) - ST_XMin(geom_postgis) > 180`
      );
      expect(rows.length).toBeGreaterThan(0);
      // Planar area in square degrees, as ST_Area measures SRID 4326
      const ring = (r: Position[]) => {
        let a = 0;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          a += (r[j]![0]! - r[i]![0]!) * (r[j]![1]! + r[i]![1]!);
        }
        return Math.abs(a) / 2;
      };
      const polygon = (p: Position[][]) =>
        ring(p[0]!) - p.slice(1).reduce((sum, h) => sum + ring(h), 0);
      for (const row of rows) {
        const split = splitCollectionAtAntimeridian({
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: JSON.parse(row.stored) as Geometry },
          ],
        });
        const reference = split.features.reduce((sum, f) => {
          const g = f.geometry;
          if (g.type === "Polygon") return sum + polygon(g.coordinates);
          if (g.type === "MultiPolygon")
            return sum + g.coordinates.reduce((a, p) => a + polygon(p), 0);
          return sum;
        }, 0);
        expect({ id: row.id, area: Number(row.tiled.toFixed(1)) }).toEqual({
          id: row.id,
          area: Number(reference.toFixed(1)),
        });
      }
    });

    it("draws antimeridian altitudes from their stored GeoJSON, without the slivers geom_postgis repair left", async () => {
      const [row] = await db.$queryRawUnsafe<Array<{ slivers: number }>>(
        `SELECT count(*)::int AS slivers
         FROM (SELECT (ST_Dump(${sourceGeometry("3")})).geom AS g FROM map_layers
               WHERE "worldId" = 'default' AND "layerType" = $1 AND "isActive") t
         WHERE ST_XMax(g) - ST_XMin(g) > 5 AND ST_YMax(g) - ST_YMin(g) < 0.3`,
        "altitudes"
      );
      expect(row!.slivers).toBe(0);
    });

    it("keeps merged altitudes rings wound the way the tile encoder winds them (as lakes are)", async () => {
      // vector-tile-js's ring area; the sign is the ring's winding in tile space
      const windings = async (layer: "altitudes" | "lakes") => {
        const tile = decode(await buildTile(db, "default", layer, 4, 15, 7), layer)!;
        const signs = new Set<number>();
        for (let i = 0; i < tile.length; i++) {
          const outer = tile.feature(i).loadGeometry()[0]!;
          let area = 0;
          for (let j = 0, k = outer.length - 1; j < outer.length; k = j++) {
            area += (outer[j]!.x - outer[k]!.x) * (outer[k]!.y + outer[j]!.y);
          }
          signs.add(Math.sign(area));
        }
        return signs;
      };
      const lakes = await windings("lakes");
      expect(lakes.size).toBe(1);
      expect(await windings("altitudes")).toEqual(lakes);
    });
  });

  describe("GET /api/map-tiles", () => {
    let root: string;
    beforeAll(() => {
      root = mkdtempSync(path.join(tmpdir(), "map-tiles-db-"));
      process.env.MAP_TILE_DIR = root;
    });
    afterAll(() => {
      rmSync(root, { recursive: true, force: true });
      delete process.env.MAP_TILE_DIR;
    });

    const get = (realm: string, version: number, layer: string, z: number, x: number, y: number) =>
      GET(
        new NextRequest(
          `http://localhost/api/map-tiles/${realm}/${version}/f1/${layer}/${z}/${x}/${y}`
        ),
        {
          params: Promise.resolve({
            realm,
            version: String(version),
            format: "f1",
            layer,
            z: String(z),
            x: String(x),
            y: String(y),
          }),
        }
      );

    const ixnayVersion = async () =>
      (await db.realm.findUnique({ where: { id: "default" }, select: { mapVersion: true } }))
        ?.mapVersion ?? 0;

    // Ixnay's altitudes crossing ±180 lie between 34S and 25N: the z2 tiles at the west and the east edge of the world
    it.each([
      [2, 0, 2],
      [2, 3, 2],
    ])(
      "renders the antimeridian altitudes tile %i/%i/%i, then serves it from disk without SQL",
      async (z, x, y) => {
        const version = await ixnayVersion();
        const cold = await get("default", version, "altitudes", z, x, y);
        expect(cold.status).toBe(200);
        expect(cold.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        const bytes = new Uint8Array(await cold.arrayBuffer());
        expect(bytes.length).toBeGreaterThan(0);
        expect(decode(bytes, "altitudes")?.length).toBeGreaterThan(0);

        const spy = jest.spyOn(db, "$queryRawUnsafe");
        const warm = await get("default", version, "altitudes", z, x, y);
        expect(new Uint8Array(await warm.arrayBuffer())).toEqual(bytes);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    );

    it("serves a tile with nothing in it as an empty 200", async () => {
      const res = await get("default", await ixnayVersion(), "lakes", 6, 0, 0);
      expect(res.status).toBe(200);
      expect(new Uint8Array(await res.arrayBuffer()).length).toBe(0);
    });
  });
});
