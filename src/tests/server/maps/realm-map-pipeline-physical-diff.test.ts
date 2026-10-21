/** @jest-environment node */
/**
 * The pipeline's `physical` step compares each traced layer with the realm's stored features exactly as the writer
 * would store them, so a dry run says what an apply would do: features stored as traced are unchanged, a stored
 * feature drawn differently is changed, a traced one the realm lacks is new, a stored one no longer traced is retired. A dry run only reports.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import type { Polygon } from "geojson";
import type { LayerEngineResult, LayerFeature } from "~/lib/maps/import/png/layer-engine";
import { realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import type { StepContext } from "~/server/modules/maps/realm-map-pipeline.context";
import { runPhysicalStep } from "~/server/modules/maps/realm-map-pipeline.physical";
import { founder } from "./map-import-fakes";

const triangle = (size: number): LayerFeature["geometry"] => ({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [size, 0],
      [size, size],
      [0, 0],
    ],
  ],
});
/** The row the writer stores for a traced feature. */
const storedRow = (key: string, size = 1) => ({
  featureId: key,
  displayName: `Zone ${key}`,
  properties: { band: key, name: `Zone ${key}` },
  // The writer stores a polygon as a multipolygon
  geometry: { type: "MultiPolygon", coordinates: [(triangle(size) as Polygon).coordinates] },
});

function dryRun(features: LayerFeature[], stored: object[], cap = Infinity) {
  const result: LayerEngineResult = {
    width: 2,
    height: 2,
    log: [],
    layers: { altitudes: features },
  };
  const ctx: StepContext = {
    db: {
      realm: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
      // Like the guarded client: a findMany with no `take` answers at most 1000 rows
      mapLayer: {
        findMany: jest.fn(async ({ take }: { take?: number } = {}) => stored.slice(0, take ?? cap)),
      },
    } as never,
    realm: { id: "r1", slug: "eurth", name: "Eurth" },
    pipeline: realmMapPipelineSchema.parse({
      art: { geo: { uploadId: "a".repeat(64) } },
      physical: { land: "geo" },
    }),
    dryRun: true,
    art: jest.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
    requestedBy: "founder_1",
    actor: founder,
    jobId: null,
    progress: jest.fn(),
    isCancelled: () => false,
    deps: { runLayerEngine: jest.fn().mockResolvedValue(result) },
  };
  return runPhysicalStep(ctx);
}

describe("past the guarded client's 1000-row cap", () => {
  it("retires every stored feature the layer no longer has (Ixnay has 4068 altitude bands)", async () => {
    const stored = Array.from({ length: 1001 }, (_, i) => storedRow(`band_${i}`));
    const report = await dryRun([], stored, 1000);
    expect(report.counts).toMatchObject({ changes: 1001 });
  });
});
