/** @jest-environment node */
import { simplifyLayerCoverage } from "~/server/modules/maps/coverage-simplify";

const TRIANGLE = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 0],
    ],
  ],
};

type Call = { sql: string; values: unknown[] };

/** A db whose `$queryRaw` answers the pg_proc probe, then the coverage query; both recorded. */
function dbAnswering(probe: boolean, rows: unknown[] | Error) {
  const calls: Call[] = [];
  const $queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join("?"), values });
    if (calls.length === 1) return Promise.resolve([{ exists: probe }]);
    return rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows);
  });
  return { db: { $queryRaw } as never, calls };
}

const request = { layerType: "political", realmId: "default", tolerance: 0.025, decimals: 4 };

describe("simplifyLayerCoverage", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("simplifies a realm's layer as one coverage and returns each feature's geometry", async () => {
    const { db, calls } = dbAnswering(true, [
      { featureId: "a", geometry: JSON.stringify(TRIANGLE) },
      { featureId: "b", geometry: JSON.stringify(TRIANGLE) },
    ]);

    const result = await simplifyLayerCoverage(db, request);

    expect(result?.get("a")).toEqual(TRIANGLE);
    expect([...(result?.keys() ?? [])]).toEqual(["a", "b"]);
    const query = calls[1]!;
    expect(query.sql).toContain("ST_CoverageSimplify");
    expect(query.sql).toContain("OVER ()");
    expect(query.values).toEqual(expect.arrayContaining(["default", "political", 0.025, 4]));
  });

  it("probes pg_proc for the function first", async () => {
    const { db, calls } = dbAnswering(true, []);
    await simplifyLayerCoverage(db, request);
    expect(calls[0]!.sql).toMatch(/pg_proc/);
    expect(calls[0]!.sql).toMatch(/st_coveragesimplify/);
  });

  it("returns null without running the query when the function is missing", async () => {
    const { db, calls } = dbAnswering(false, []);
    await expect(simplifyLayerCoverage(db, request)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("leaves rows that cross the antimeridian out of the coverage", async () => {
    // geom_postgis of a row stored with longitudes jumping 180 -> -180 is a planar sliver spanning the world
    const { db, calls } = dbAnswering(true, []);
    await simplifyLayerCoverage(db, request);
    expect(calls[1]!.sql).toMatch(/ST_XMax\(geom_postgis\) - ST_XMin\(geom_postgis\) <= 180/);
  });

  it("returns null, rather than throwing, when the coverage is not simplifiable", async () => {
    const { db } = dbAnswering(true, new Error("TopologyException: found non-noded intersection"));
    await expect(simplifyLayerCoverage(db, request)).resolves.toBeNull();
  });

  it("returns null when the probe itself fails", async () => {
    const db = { $queryRaw: jest.fn().mockRejectedValue(new Error("connection reset")) } as never;
    await expect(simplifyLayerCoverage(db, request)).resolves.toBeNull();
  });

  it("drops a feature the simplification emptied or returned unreadable, so the caller falls back for it", async () => {
    const { db } = dbAnswering(true, [
      { featureId: "ok", geometry: JSON.stringify(TRIANGLE) },
      { featureId: "empty", geometry: JSON.stringify({ type: "Polygon", coordinates: [] }) },
      { featureId: "junk", geometry: "not json" },
      { featureId: "nothing", geometry: null },
    ]);

    const result = await simplifyLayerCoverage(db, request);

    expect([...(result?.keys() ?? [])]).toEqual(["ok"]);
  });
});
