/**
 * scripts/perf/atlas-bench-server.ts - the server-side acceptance measurements of `bun run perf:atlas`: the layer and
 * tile routes (their GET handlers called in process, no HTTP server), the Caphiria geo profile, and coverage
 * simplification of Ixnay's political layer. Each returns table rows (atlas-bench-report.ts).
 */
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { NextRequest } from "next/server";
import { z } from "zod";
import type { Feature, Geometry } from "geojson";
import { GET as layerRoute } from "~/app/api/map-layers/[realm]/[version]/[layer]/route";
import { GET as tileRoute } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { TILED_LAYERS, type TiledLayer } from "~/lib/maps/decorative-tiles";
import { LAYER_FORMAT_VERSION } from "~/lib/maps/layer-format";
import { TILE_FORMAT_VERSION } from "~/lib/maps/tile-format";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { geoProfileProcedures } from "~/server/api/routers/geo/core/geo-profile";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { simplifyLayerCoverage } from "~/server/modules/maps/coverage-simplify";
import { loadLayerFromDB } from "~/server/modules/maps/layer-loader";
import { getCompressionForLayer, type ZoomBucket } from "~/server/modules/maps/layer-lod";
import {
  atMost,
  exactly,
  markedPayload,
  matches,
  median,
  RESULT_MARKER,
  type TargetResult,
} from "./atlas-bench-report";
import { client, countStatements, timed } from "./atlas-bench-client";

const BUCKETS: readonly ZoomBucket[] = [0, 1, 2];
const IMMUTABLE = "public, max-age=31536000, immutable";
/** "immutable" for the versioned URLs' header, else the header itself (so a wrong one is readable in the table). */
const cacheKind = (cacheControl: string) =>
  cacheControl === IMMUTABLE ? "immutable" : cacheControl;
/** The event-loop budget of a cache hit (spec: no map layer or tile route blocks the loop longer on a hit). */
const HIT_BLOCK_LIMIT_MS = 50;
const LAYER_HITS_PER_BUCKET = 20;

const log = (line: string) => process.stderr.write(`${line}\n`);
const ms = (values: readonly number[]) => values.map((value) => value.toFixed(0)).join(" / ");

// --- Layer route -------------------------------------------------------------------------------------------------

/** Asked by realm id, as the client does: only an ID-addressed URL is immutable (a slug can be renamed). */
function layerRequest(version: number, bucket: ZoomBucket, headers: Record<string, string> = {}) {
  const url = `http://localhost/api/map-layers/${DEFAULT_REALM_ID}/${version}/political?bucket=${bucket}&format=${LAYER_FORMAT_VERSION}`;
  return layerRoute(new NextRequest(url, { headers }), {
    params: Promise.resolve({
      realm: DEFAULT_REALM_ID,
      version: String(version),
      layer: "political",
    }),
  });
}

/** Ixnay's political layer by bucket: the first request builds it (cold), the rest are served from the byte cache. */
export async function layerTargets(version: number): Promise<TargetResult[]> {
  log("layer route: cold builds, hits, revalidation");
  const cold: number[] = [];
  const kilobytes: number[] = [];
  let etag = "";
  let cacheControl = "";
  let notServed = 0;
  for (const bucket of BUCKETS) {
    const { result: response, ms: took } = await timed(() => layerRequest(version, bucket));
    cold.push(took);
    if (response.status !== 200) notServed++;
    kilobytes.push((await response.text()).length / 1024);
    if (bucket === 0) {
      etag = response.headers.get("etag") ?? "";
      cacheControl = response.headers.get("cache-control") ?? "";
    }
  }
  const hits: number[] = [];
  for (const bucket of BUCKETS) {
    for (let i = 0; i < LAYER_HITS_PER_BUCKET; i++) {
      const { result: response, ms: took } = await timed(() => layerRequest(version, bucket));
      hits.push(took);
      if (response.status !== 200) notServed++;
      await response.text();
    }
  }
  const { result: revalidated, ms: revalidatedMs } = await timed(() =>
    layerRequest(version, 0, { "If-None-Match": etag })
  );
  return [
    atMost(
      "layer route: event-loop block on a cache hit",
      // An error answer is fast too: unless every request was served, there is no hit time to report
      notServed === 0 ? Math.max(...hits) : Number.NaN,
      HIT_BLOCK_LIMIT_MS,
      "ms",
      `political cold build ${ms(cold)} ms (buckets 0 / 1 / 2), ${hits.length} hits median ${median(hits).toFixed(2)} ms, packed ${ms(kilobytes)} KB, ${notServed} not served`
    ),
    exactly(
      "layer route: repeat request with If-None-Match",
      revalidated.status,
      304,
      "",
      `HTTP status, answered in ${revalidatedMs.toFixed(2)} ms`
    ),
    matches(
      "layer route: Cache-Control on the versioned URL",
      cacheKind(cacheControl),
      "immutable",
      IMMUTABLE
    ),
  ];
}

// --- Tile route --------------------------------------------------------------------------------------------------

interface Tile {
  layer: TiledLayer;
  zoom: number;
  x: number;
  y: number;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The globe view's tile set: z1 and z2 of altitudes, rivers and lakes (60 tiles). */
const GLOBE_TILES: readonly Tile[] = TILED_LAYERS.flatMap((layer) =>
  [1, 2].flatMap((zoom) =>
    range(2 ** zoom).flatMap((x) => range(2 ** zoom).map((y) => ({ layer, zoom, x, y })))
  )
);

const tileHitsSchema = z.object({
  served: z.number(),
  maxMs: z.number(),
  medianMs: z.number(),
  statements: z.number(),
  cacheControl: z.string(),
});
type TileRun = z.infer<typeof tileHitsSchema> & { totalMs: number };

function tileRequest(version: number, { layer, zoom, x, y }: Tile) {
  const url = `http://localhost/api/map-tiles/${DEFAULT_REALM_ID}/${version}/f${TILE_FORMAT_VERSION}/${layer}/${zoom}/${x}/${y}`;
  return tileRoute(new NextRequest(url), {
    params: Promise.resolve({
      realm: DEFAULT_REALM_ID,
      version: String(version),
      format: `f${TILE_FORMAT_VERSION}`,
      layer,
      z: String(zoom),
      x: String(x),
      y: String(y),
    }),
  });
}

/** Requests every globe tile in turn through the route. */
async function requestGlobeTiles(version: number): Promise<TileRun> {
  const times: number[] = [];
  let served = 0;
  let cacheControl = "";
  const { statements, result } = await countStatements(async () => {
    const startedAt = performance.now();
    for (const tile of GLOBE_TILES) {
      const { result: response, ms: took } = await timed(() => tileRequest(version, tile));
      times.push(took);
      if (response.status === 200) served++;
      cacheControl = response.headers.get("cache-control") ?? "";
      await response.arrayBuffer();
    }
    return performance.now() - startedAt;
  });
  return {
    served,
    maxMs: Math.max(...times),
    medianMs: median(times),
    statements,
    cacheControl,
    totalMs: result,
  };
}

/** Start-up work that modules defer (about 30 ms, right after the imports) has finished by then. */
const STARTUP_SETTLE_MS = 250;

/** Child-process mode (`atlas-bench.ts --tile-hits <version>`): a process that has never rendered or read these tiles. */
export async function printTileHits(version: number): Promise<void> {
  // Without the wait, the second request of a fresh process is the one that runs that work, and reads as a block
  await sleep(STARTUP_SETTLE_MS);
  process.stdout.write(`${RESULT_MARKER}${JSON.stringify(await requestGlobeTiles(version))}\n`);
}

/** The globe tiles served by a fresh process from the tile folder (no in-memory copy), as it would after a restart. */
function diskHits(entry: string, version: number): z.infer<typeof tileHitsSchema> | null {
  const child = spawnSync(process.execPath, [entry, "--tile-hits", String(version)], {
    env: process.env,
    encoding: "utf8",
  });
  const payload = markedPayload(child.stdout ?? "");
  const parsed = payload === null ? null : tileHitsSchema.safeParse(JSON.parse(payload));
  return parsed?.success ? parsed.data : null;
}

/** Valid only when every tile answered 200, so a failing tile cannot read as a fast hit. */
const whenServed = (run: { served: number }, value: number) =>
  run.served === GLOBE_TILES.length ? value : Number.NaN;

/** Cold render of the globe tile set into an empty folder, then warm hits from the folder and from memory. */
export async function tileTargets(version: number, entry: string): Promise<TargetResult[]> {
  log(`tile route: rendering ${GLOBE_TILES.length} globe tiles cold`);
  const cold = await requestGlobeTiles(version);
  log("tile route: memory hits, then disk hits in a fresh process");
  const memory = await requestGlobeTiles(version);
  const disk = diskHits(entry, version) ?? {
    served: 0,
    maxMs: Number.NaN,
    medianMs: Number.NaN,
    statements: Number.NaN,
    cacheControl: "(the child run failed)",
  };
  return [
    exactly(
      "tile route: DB statements on a warm disk hit",
      whenServed(disk, disk.statements),
      0,
      "",
      `${GLOBE_TILES.length} globe tiles (z1-z2 altitudes, rivers, lakes); memory hits ${memory.statements} statements`
    ),
    atMost(
      "tile route: event-loop block on a warm hit",
      Math.max(whenServed(disk, disk.maxMs), whenServed(memory, memory.maxMs)),
      HIT_BLOCK_LIMIT_MS,
      "ms",
      `cold render ${cold.totalMs.toFixed(0)} ms (${cold.statements} statements, ${cold.served} served); disk hit median ${disk.medianMs.toFixed(2)} / max ${disk.maxMs.toFixed(2)} ms; memory hit median ${memory.medianMs.toFixed(2)} / max ${memory.maxMs.toFixed(2)} ms`
    ),
    matches(
      "tile route: Cache-Control on the versioned URL",
      cacheKind(disk.cacheControl),
      "immutable",
      IMMUTABLE
    ),
  ];
}

// --- Geo profile -------------------------------------------------------------------------------------------------

const GEO_PROFILE_RUNS = 5;

/** `getCountryGeoProfile` for Caphiria, its tRPC cache emptied before each call: the median of warm calls. */
export async function geoProfileTargets(): Promise<TargetResult[]> {
  log("geo profile: Caphiria");
  const country = await client.country.findFirst({
    where: { name: "Caphiria", realmId: DEFAULT_REALM_ID },
    select: { id: true },
  });
  if (!country) return [atMost("geo profile: Caphiria", Number.NaN, 400, "ms", "no such country")];
  const ctx = {
    db: client,
    user: null,
    auth: null,
    rateLimitIdentifier: "atlas-bench",
    headers: new Headers(),
  } as never;
  const caller = createCallerFactory(createTRPCRouter(geoProfileProcedures))(ctx);
  const call = async () => {
    clearTrpcMemoryCache();
    return timed(() => caller.getCountryGeoProfile({ countryId: country.id }));
  };
  const first = (await call()).ms;
  const runs: number[] = [];
  for (let i = 0; i < GEO_PROFILE_RUNS; i++) runs.push((await call()).ms);
  return [
    atMost(
      "geo profile: getCountryGeoProfile for Caphiria",
      median(runs),
      400,
      "ms",
      `median of ${GEO_PROFILE_RUNS} warm calls (${ms(runs)} ms, tRPC cache bypassed); first call ${first.toFixed(0)} ms`
    ),
  ];
}

// --- Coverage simplification -------------------------------------------------------------------------------------

/** Points in a polygon or multipolygon (the political layer holds nothing else). */
function countPoints(geometry: Geometry | null | undefined): number {
  if (geometry?.type === "Polygon")
    return geometry.coordinates.reduce((n, ring) => n + ring.length, 0);
  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.reduce(
      (n, polygon) => n + polygon.reduce((sum, ring) => sum + ring.length, 0),
      0
    );
  }
  return 0;
}

/** Points per feature id of the layer as served (a feature split at the antimeridian counts once). */
function pointsById(features: readonly Feature[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const feature of features) {
    const id = String(feature.properties?._id);
    points.set(id, (points.get(id) ?? 0) + countPoints(feature.geometry));
  }
  return points;
}

interface BucketCoverage {
  points: number;
  covered: number;
  /** Features not simplified by the coverage that the per-polygon fallback left at full size. */
  unsimplified: string[];
}

async function coverageOfBucket(
  version: number,
  bucket: ZoomBucket,
  before: ReadonlyMap<string, number>
): Promise<BucketCoverage> {
  const { simplifyTolerance, coordinatePrecision } = getCompressionForLayer("political", bucket);
  const coverage = await simplifyLayerCoverage(client, {
    layerType: "political",
    realmId: DEFAULT_REALM_ID,
    tolerance: simplifyTolerance,
    decimals: coordinatePrecision,
  });
  const layer = await loadLayerFromDB(client, "political", bucket, DEFAULT_REALM_ID, version);
  const after = pointsById(layer?.features ?? []);
  const unsimplified = [...before]
    .filter(([id, points]) => !coverage?.has(id) && (after.get(id) ?? points) >= points)
    .map(([id]) => id);
  return {
    points: [...after.values()].reduce((sum, points) => sum + points, 0),
    covered: coverage?.size ?? 0,
    unsimplified,
  };
}

/**
 * Ixnay's political layer through PostGIS `ST_CoverageSimplify` for each zoom bucket (the SQL runs for real here; the
 * unit tests only assert its text). Every active feature must come out simplified: either by the coverage, or, for
 * the rows it leaves out (those crossing the antimeridian), by the per-polygon fallback, which must have reduced it.
 */
export async function coverageTargets(version: number): Promise<TargetResult[]> {
  log("coverage simplify: political layer, three buckets");
  const rows = await client.$queryRaw<Array<{ featureId: string; geometry: Geometry }>>`
    SELECT "featureId", geometry FROM map_layers
    WHERE "worldId" = ${DEFAULT_REALM_ID} AND "layerType" = 'political' AND "isActive"`;
  const before = new Map(rows.map((row) => [row.featureId, countPoints(row.geometry)]));
  const rawPoints = [...before.values()].reduce((sum, points) => sum + points, 0);
  const buckets: BucketCoverage[] = [];
  for (const bucket of BUCKETS) buckets.push(await coverageOfBucket(version, bucket, before));
  const skipped = buckets.flatMap((bucket) => bucket.unsimplified);
  return [
    exactly(
      "coverage simplify: political features left unsimplified",
      skipped.length,
      0,
      "",
      `${before.size} features, ${rawPoints} points raw -> ${buckets.map((b) => b.points).join(" / ")} (buckets 0 / 1 / 2); ST_CoverageSimplify covered ${buckets.map((b) => b.covered).join(" / ")} of ${before.size}, the other ${before.size - Math.min(...buckets.map((b) => b.covered))} by the per-polygon fallback${skipped.length ? `; unsimplified: ${skipped.join(", ")}` : ""}`
    ),
  ];
}
