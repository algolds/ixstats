/** @jest-environment node */
import { PrismaClient } from "@prisma/client";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import type { Geometry, Position } from "geojson";
import { splitCollectionAtAntimeridian } from "~/lib/maps/map-utils";
import { buildTile, sourceGeometry } from "~/server/api/routers/geo/core/tiles";

const url = process.env.TILES_DB_URL;
const run = url ? describe : describe.skip;

run("buildTile against the clone DB", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  afterAll(() => db.$disconnect());

  const decode = async (layer: "altitudes" | "rivers", z: number, x: number, y: number) =>
    new VectorTile(new PbfReader(await buildTile(db, "default", layer, z, x, y))).layers[layer];

  it("builds the whole-world altitudes tile, poles included, merged by colour", async () => {
    const tile = await decode("altitudes", 0, 0, 0);
    expect(tile?.length).toBeGreaterThan(0);
    const colours = Array.from(
      { length: tile!.length },
      (_, i) => tile!.feature(i).properties._fillColor
    );
    expect(new Set(colours).size).toBe(colours.length);
  });

  it.each(["altitudes", "rivers"] as const)(
    "keeps the whole-world %s tile under 150 KB (simplified to half a pixel)",
    async (layer) => {
      expect((await buildTile(db, "default", layer, 0, 0, 0)).length).toBeLessThan(150 * 1024);
    }
  );

  it.each(["altitudes"])(
    "splits %s shapes that cross the antimeridian instead of stretching them across the world",
    async (layer) => {
      const [row] = await db.$queryRawUnsafe<Array<{ widest: number }>>(
        `SELECT max(ST_XMax((d).geom) - ST_XMin((d).geom)) AS widest
         FROM (SELECT ST_Dump(${sourceGeometry("3")}) AS d FROM map_layers
               WHERE "worldId" = 'default' AND "layerType" = $1 AND "isActive") t`,
        layer
      );
      expect(row!.widest).toBeLessThanOrEqual(180);
    }
  );

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

  it("keeps merged altitudes rings wound the way the tile encoder winds them (as lakes are)", async () => {
    // vector-tile-js's ring area; the sign is the ring's winding in tile space
    const windings = async (layer: "altitudes" | "lakes") => {
      const tile = new VectorTile(new PbfReader(await buildTile(db, "default", layer, 4, 15, 7)))
        .layers[layer]!;
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

  it.each(["altitudes"])(
    "draws %s antimeridian shapes from their stored GeoJSON, without the slivers geom_postgis repair left",
    async (layer) => {
      const [row] = await db.$queryRawUnsafe<Array<{ slivers: number }>>(
        `SELECT count(*)::int AS slivers
         FROM (SELECT (ST_Dump(${sourceGeometry("3")})).geom AS g FROM map_layers
               WHERE "worldId" = 'default' AND "layerType" = $1 AND "isActive") t
         WHERE ST_XMax(g) - ST_XMin(g) > 5 AND ST_YMax(g) - ST_YMin(g) < 0.3`,
        layer
      );
      expect(row!.slivers).toBe(0);
    }
  );

  it("builds a rivers tile with the properties the paint rules read", async () => {
    const tile = await decode("rivers", 2, 2, 1);
    expect(tile?.length).toBeGreaterThan(0);
    expect(tile!.feature(0).properties).toEqual(
      expect.objectContaining({ _id: expect.any(String), _areaSqKm: expect.any(Number) })
    );
  });
});
