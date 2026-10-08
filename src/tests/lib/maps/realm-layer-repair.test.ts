/** @jest-environment node */
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(true),
}));

import type { MultiPolygon } from "geojson";
import {
  planLayerRepair,
  readLayerFeatures,
  repairRealmLayer,
  type LayerFeatureState,
} from "~/lib/maps/realm-layer-repair";

const square = (x: number, size = 1): MultiPolygon => ({
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [x, 0],
        [x + size, 0],
        [x + size, size],
        [x, size],
        [x, 0],
      ],
    ],
  ],
});

const COVERAGE = { tolerance: 0.045, smooth: 2 };

function feature(key: string, over: Partial<LayerFeatureState> = {}): LayerFeatureState {
  return {
    id: `row-${key}`,
    key,
    countryId: null,
    name: key,
    properties: {},
    geometry: square(0),
    hash: `h-${key}`,
    crosses: false,
    valid: true,
    reason: "Valid Geometry",
    repeated: 0,
    vertices: 5,
    storedType: "ST_MultiPolygon",
    ...over,
  };
}

const stamped = (key: string, over: Partial<LayerFeatureState> = {}) =>
  feature(key, { properties: { coverage: { ...COVERAGE, hash: `h-${key}` } }, ...over });

describe("planLayerRepair", () => {
  it("is unchanged for a healthy layer without smoothing", () => {
    const plan = planLayerRepair([feature("A"), feature("B")], { trims: [], coverage: null });
    expect(plan.changed).toBe(false);
    expect(plan.smoothing.status).toBe("off");
  });

  it("is unchanged when every feature is smoothed with these settings and kept its smoothed outline", () => {
    const plan = planLayerRepair([stamped("A"), stamped("B")], { trims: [], coverage: COVERAGE });
    expect(plan.smoothing).toMatchObject({ status: "up-to-date", pending: [] });
    expect(plan.changed).toBe(false);
  });

  it("smooths the whole layer again from unsmoothed outlines when one feature is new", () => {
    const sourceRaw = new Map([
      ["A", { geometry: square(10), sourceHash: "s-A" }],
      ["B", { geometry: square(20), sourceHash: "s-B" }],
    ]);
    const plan = planLayerRepair(
      [
        stamped("A", { properties: { sourceHash: "s-A", coverage: { ...COVERAGE, hash: "h-A" } } }),
        feature("B", { properties: { sourceHash: "s-B" } }),
      ],
      { trims: [], coverage: COVERAGE, sourceRaw }
    );
    expect(plan.smoothing).toMatchObject({
      status: "smooth",
      pending: ["B"],
      fromSource: ["A", "B"],
    });
    expect(plan.changed).toBe(true);
    // A smoothed feature goes back to its source outline, so no corner is rounded twice
    expect(plan.inputs.get("A")).toEqual(square(10));
    expect(plan.inputs.get("B")).toEqual(square(20));
  });

  it("takes a feature's own outline when it was edited since smoothing, or has no source", () => {
    const sourceRaw = new Map([["A", { geometry: square(10), sourceHash: "s-A" }]]);
    const plan = planLayerRepair(
      [
        stamped("A", {
          hash: "edited",
          properties: { sourceHash: "s-A", coverage: { ...COVERAGE, hash: "h-A" } },
        }),
        feature("B", { geometry: square(3) }),
      ],
      { trims: [], coverage: COVERAGE, sourceRaw }
    );
    expect(plan.smoothing.status).toBe("smooth");
    expect(plan.inputs.get("A")).toEqual(square(0));
    expect(plan.inputs.get("B")).toEqual(square(3));
  });

  it("uses the source only while it still has the outline the feature was written from", () => {
    const sourceRaw = new Map([["A", { geometry: square(10), sourceHash: "newer" }]]);
    const plan = planLayerRepair([feature("A", { properties: { sourceHash: "s-A" } })], {
      trims: [],
      coverage: COVERAGE,
      sourceRaw,
    });
    expect(plan.inputs.get("A")).toEqual(square(0));
    expect(plan.smoothing.fromSource).toEqual([]);
  });

  it("will not smooth when a smoothed feature's unsmoothed outline is unknown (it would be rounded twice)", () => {
    const plan = planLayerRepair([stamped("A"), feature("B")], { trims: [], coverage: COVERAGE });
    expect(plan.smoothing).toMatchObject({ status: "blocked", blocked: ["A"] });
    expect(plan.changed).toBe(false);
  });

  it("will not smooth a synced feature without a record when the source could not be read", () => {
    const plan = planLayerRepair([feature("A", { properties: { sourceHash: "s-A" } })], {
      trims: [],
      coverage: COVERAGE,
      sourceUnavailable: "HTTP 404",
    });
    expect(plan.smoothing).toMatchObject({ status: "blocked", blocked: ["A"] });
  });

  it("smooths again with new settings, from the source", () => {
    const sourceRaw = new Map([["A", { geometry: square(10), sourceHash: "s-A" }]]);
    const plan = planLayerRepair(
      [
        stamped("A", {
          properties: { sourceHash: "s-A", coverage: { tolerance: 0.1, smooth: 2, hash: "h-A" } },
        }),
      ],
      { trims: [], coverage: COVERAGE, sourceRaw }
    );
    expect(plan.smoothing).toMatchObject({ status: "smooth", pending: ["A"] });
  });

  it("repairs invalid outlines, repeated points and overlaps; rows across ±180 are left out of every count", () => {
    const plan = planLayerRepair(
      [
        feature("A", { valid: false, reason: "Self-intersection" }),
        feature("B", { repeated: 2 }),
        feature("C", { storedType: "ST_Polygon" }),
        feature("Z", { crosses: true, valid: false }),
      ],
      { trims: [{ key: "B", removedKm2: 3 }], coverage: null }
    );
    expect(plan.needsRepair).toEqual(["A", "B", "C"]);
    expect(plan.changed).toBe(true);
    expect(plan.crossing).toEqual(["Z"]);
  });
});

describe("repairRealmLayer", () => {
  function repairDb(rows: Array<Record<string, unknown>>) {
    const db: any = {
      country: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      mapLayer: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(async ({ where }: any) => ({
          id: `row-${where.realmId_layerType_featureId.featureId}`,
        })),
        update: jest.fn(),
      },
      mapImport: { create: jest.fn().mockResolvedValue({ id: "imp1" }) },
      $queryRawUnsafe: jest.fn(async (sql: string, ...params: any[]) => {
        if (sql.includes("ST_IsValidReason")) return rows;
        if (
          sql.includes("AS geojson") &&
          !sql.includes("ST_Difference") &&
          !sql.includes("ST_CoverageSimplify")
        )
          return [{ geojson: params[0] }];
        return [];
      }),
      $transaction: jest.fn((cb: any) => cb(db)),
    };
    return db;
  }

  const row = (key: string, properties: object) => ({
    id: `row-${key}`,
    key,
    countryId: null,
    name: key,
    properties,
    geojson: JSON.stringify(square(0)),
    hash: `h-${key}`,
    crosses: false,
    valid: true,
    reason: "Valid Geometry",
    repeated: 0,
    vertices: 5,
    storedType: "ST_MultiPolygon",
  });

  it("reads each active polygon of the layer with its health, record and outline hash", async () => {
    const db = repairDb([row("A", { coverage: { ...COVERAGE, hash: "h-A" } })]);
    const features = await readLayerFeatures(db, "eurth-id", "political");
    expect(features[0]).toMatchObject({ key: "A", hash: "h-A", geometry: square(0), valid: true });
    expect(db.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(["eurth-id", "political"]);
  });

  it("a dry run writes nothing", async () => {
    const db = repairDb([row("A", {})]);
    const report = await repairRealmLayer(db, "eurth-id", {
      layerType: "political",
      coverage: COVERAGE,
      apply: false,
      createdBy: "test",
    });
    expect(report.plan.smoothing.status).toBe("smooth");
    expect(report.written).toBeNull();
    expect(db.mapLayer.upsert).not.toHaveBeenCalled();
  });

  it("an up-to-date layer is left alone even with apply", async () => {
    const db = repairDb([row("A", { coverage: { ...COVERAGE, hash: "h-A" } })]);
    const report = await repairRealmLayer(db, "eurth-id", {
      layerType: "political",
      coverage: COVERAGE,
      apply: true,
      createdBy: "test",
    });
    expect(report.plan.changed).toBe(false);
    expect(report.written).toBeNull();
    expect(db.mapLayer.upsert).not.toHaveBeenCalled();
  });

  it("applying writes every polygon from its unsmoothed outline, its old record dropped, with a rollback snapshot", async () => {
    const db = repairDb([row("A", { sourceHash: "s-A", fill: "#123456" })]);
    const report = await repairRealmLayer(db, "eurth-id", {
      layerType: "political",
      coverage: COVERAGE,
      apply: true,
      createdBy: "test",
      sourceRaw: new Map([["A", { geometry: square(10), sourceHash: "s-A" }]]),
    });
    expect(report.written?.written).toEqual(["A"]);
    expect(report.mapImportId).toBe("imp1");
    const upsert = db.mapLayer.upsert.mock.calls[0][0];
    expect(upsert.update.properties).toEqual({ sourceHash: "s-A", fill: "#123456" });
    expect(upsert.update.geometry).toEqual(square(10));
    expect(db.mapImport.create.mock.calls[0][0].data).toMatchObject({
      realmId: "eurth-id",
      layerTypes: ["political"],
      mode: "merge",
      createdBy: "test",
    });
  });
});
