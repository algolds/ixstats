/** @jest-environment node */
/**
 * The pipeline's `areas` and `physical` steps change `map_layers.areaSqKm`, which the layers and tiles serve as
 * `_areaSqKm`: each gives the map a new version, after the measuring (so a URL of the new version never holds the
 * old areas).
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
const isPostGISAvailable = jest.fn();
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: (...a: unknown[]) => isPostGISAvailable(...a),
}));
const order: string[] = [];
const recomputeRealmMapAreas = jest.fn();
jest.mock("~/server/modules/realms/realms.map", () => ({
  recomputeRealmMapAreas: (...a: unknown[]) => recomputeRealmMapAreas(...a),
}));
const invalidateRealmMap = jest.fn();
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: (...a: unknown[]) => invalidateRealmMap(...a),
}));
const writePipelineLayers = jest.fn();
jest.mock("~/server/modules/maps/map-import.pipeline", () => ({
  writePipelineLayers: (...a: unknown[]) => writePipelineLayers(...a),
}));

import type { LayerEngineResult } from "~/lib/maps/import/png/layer-engine";
import { realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import type { StepContext } from "~/server/modules/maps/realm-map-pipeline.context";
import { runPhysicalStep } from "~/server/modules/maps/realm-map-pipeline.physical";
import { runAreasStep } from "~/server/modules/maps/realm-map-pipeline.steps";
import { founder } from "./map-import-fakes";

const TRACED: LayerEngineResult = {
  width: 2,
  height: 2,
  log: [],
  layers: {
    land: [
      {
        key: "land-1",
        name: "Land",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  },
};

function stepContext(overrides: Partial<StepContext> = {}): StepContext {
  const db = {
    realm: { findUnique: jest.fn().mockResolvedValue({ settings: {} }), update: jest.fn() },
    mapLayer: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ total: 3, changed: 2 }]),
  };
  return {
    db: db as never,
    realm: { id: "r1", slug: "eurth", name: "Eurth" },
    pipeline: realmMapPipelineSchema.parse({
      art: { geo: { uploadId: "a".repeat(64) } },
      physical: { land: "geo" },
    }),
    dryRun: false,
    art: jest.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
    requestedBy: "founder_1",
    actor: founder,
    jobId: null,
    progress: jest.fn(),
    isCancelled: () => false,
    deps: { runLayerEngine: jest.fn().mockResolvedValue(TRACED) },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  isPostGISAvailable.mockResolvedValue(true);
  recomputeRealmMapAreas.mockImplementation(async () => {
    order.push("measure");
    return { updated: 12, radiusKm: 6371 };
  });
  invalidateRealmMap.mockImplementation(async () => {
    order.push("bump");
    return 5;
  });
  writePipelineLayers.mockImplementation(async () => {
    order.push("write");
    return { imported: 1, deactivated: 0, rejected: [], mapImportId: "imp1" };
  });
});

describe("areas step", () => {
  it("gives the map a new version after it has measured the areas", async () => {
    const report = await runAreasStep(stepContext());

    expect(report.status).toBe("changed");
    expect(order).toEqual(["measure", "bump"]);
    expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), "r1");
  });

  it("changes nothing, so bumps nothing, on a dry run or when every area is measured already", async () => {
    await runAreasStep(stepContext({ dryRun: true }));

    const measured = stepContext();
    jest.mocked(measured.db.$queryRawUnsafe).mockResolvedValue([{ total: 3, changed: 0 }]);
    const report = await runAreasStep(measured);

    expect(report.status).toBe("unchanged");
    expect(recomputeRealmMapAreas).not.toHaveBeenCalled();
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });
});

describe("physical step", () => {
  it("bumps the version again once the areas are measured: the write's own bump came before them", async () => {
    const report = await runPhysicalStep(stepContext());

    expect(report.status).toBe("changed");
    expect(order).toEqual(["write", "measure", "bump"]);
  });

  it("writes and bumps nothing on a dry run", async () => {
    const report = await runPhysicalStep(stepContext({ dryRun: true }));

    expect(report.status).toBe("would-change");
    expect(order).toEqual([]);
  });
});
