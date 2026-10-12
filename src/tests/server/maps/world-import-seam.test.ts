/** @jest-environment node */
/**
 * Longitudes past ±180 in a real generated world. The Eurth preset at seed 777 smooths rivers across the
 * antimeridian to about -204 and 205 degrees, which the realm map writer refuses (its geometry check takes ±180 only).
 * The import cuts them at the seam and shifts the far parts in (world-seam.ts); this runs a whole generated world
 * through the dry run and the apply to show nothing is lost and the writer accepts every feature.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Feature, LineString, MultiLineString, Position } from "geojson";
import { encodeCells, type WorldBundle } from "~/lib/maps/import/world-bundle";
import { geometryProblem } from "~/lib/maps/realm-map-writer";
import { generateWorld } from "~/lib/worldgen/v2";
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import type { GeneratedWorld } from "~/lib/worldgen/v2/types";
import { findImportRealm } from "~/server/modules/maps/map-import.realm";
import { applyWorld, runWorldDryRun } from "~/server/modules/maps/world-import";
import { loadWorldBundle, prepareWorld } from "~/server/modules/maps/world-import.prepare";
import { jobFor, seedRealm, storeBundle } from "./world-import-fixtures";

jest.setTimeout(120_000);

let dir: string;
let world: GeneratedWorld;
let bundle: WorldBundle;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-seam-"));
  process.env.MAP_IMPORT_DIR = dir;
  world = generateWorld({ ...DEFAULT_PARAMS, ...WORLD_PRESETS.eurth, seed: 777 });
  const { background, altitudes, climate, political, rivers, lakes, icecaps } = world.layers;
  bundle = {
    version: 1,
    seed: world.seed,
    params: world.params,
    source: "preset",
    layers: {
      background: background!,
      altitudes: altitudes!,
      climate: climate!,
      political: political!,
      rivers: rivers!,
      lakes: lakes!,
      icecaps: icecaps!,
    },
    slots: world.slots.map(({ key, name, colour, population, gdpPerCapita, areaKm2 }) => ({
      key,
      name,
      colour,
      claimable: true,
      population,
      gdpPerCapita,
      areaKm2,
    })),
    cells: encodeCells(world.cells),
  };
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const lines = (feature: Feature): Position[][] =>
  feature.geometry.type === "LineString"
    ? [(feature.geometry as LineString).coordinates]
    : (feature.geometry as MultiLineString).coordinates;
const length = (line: Position[]) =>
  line
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p[0]! - line[i]![0]!, p[1]! - line[i]![1]!), 0);
const reach = (feature: Feature) =>
  Math.max(
    ...lines(feature)
      .flat()
      .map(([x]) => Math.abs(x!))
  );

describe("a generated world whose rivers cross the antimeridian", () => {
  it("has rivers the writer's own geometry check refuses as generated", () => {
    const over = bundle.layers.rivers.features.filter((f) => reach(f) > 180);
    expect(over.length).toBeGreaterThan(0);
    expect(Math.max(...over.map(reach))).toBeGreaterThan(200);
    for (const river of over) {
      expect(geometryProblem(river.geometry, "any")).toMatch(/not a finite lon\/lat pair in range/);
    }
    // the polygons are clamped to ±180 by the generator, so only the rivers need fitting
    for (const layer of [
      "political",
      "background",
      "altitudes",
      "climate",
      "lakes",
      "icecaps",
    ] as const) {
      const features = bundle.layers[layer]!.features;
      expect(features.every((f) => geometryProblem(f.geometry, "any") === null)).toBe(true);
    }
  });

  it("passes the dry run and comes out of the preparation inside ±180 with every river kept whole", async () => {
    const db = seedRealm();
    const uploadId = await storeBundle(bundle);
    const diff = await runWorldDryRun(db, jobFor(uploadId));
    expect(diff.layers.rivers.create).toBe(bundle.layers.rivers.features.length);
    expect(diff.slots.create).toBe(world.slots.length);

    const prepared = await prepareWorld(
      db,
      await findImportRealm(db, "r1"),
      await loadWorldBundle(uploadId)
    );
    for (const [layer, collection] of Object.entries(prepared.layers)) {
      for (const feature of collection.features) {
        expect(
          geometryProblem(feature.geometry, layer === "political" ? "polygonal" : "any")
        ).toBeNull();
      }
    }
    const fitted = prepared.layers.rivers!.features;
    expect(fitted).toHaveLength(bundle.layers.rivers.features.length);
    // each river is cut where it crosses, so no length is lost and none is added across the map
    bundle.layers.rivers.features.forEach((raw, i) => {
      const before = length(lines(raw)[0]!);
      const after = lines(fitted[i]!).reduce((sum, line) => sum + length(line), 0);
      expect(after).toBeCloseTo(before, 6);
      expect(reach(fitted[i]!)).toBeLessThanOrEqual(180);
    });
    const cut = fitted.filter((f) => f.geometry.type === "MultiLineString");
    expect(cut.length).toBeGreaterThan(0);
  });

  it("is written whole: the writer rejects nothing", async () => {
    const db = seedRealm();
    const result = await applyWorld(db, jobFor(await storeBundle(bundle)), undefined, {
      runRelief: jest.fn().mockResolvedValue({ version: "v", tiles: 0, skipped: 0, built: true }),
    });
    expect(result.rejected).toEqual([]);
    const rivers = db.mapLayer.rows.filter(
      (r: { layerType: string; isActive: boolean }) => r.layerType === "rivers" && r.isActive
    );
    expect(rivers).toHaveLength(bundle.layers.rivers.features.length);
    for (const river of rivers) {
      expect(geometryProblem(river.geometry, "any")).toBeNull();
    }
    expect(result.slots.created).toBe(world.slots.length);
  });
});
