/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({ isPostGISAvailable: jest.fn().mockResolvedValue(false) }));

import type { Polygon } from "geojson";
import { applyMapImportPlan, planMapImport } from "~/server/modules/maps/map-import.apply";
import { listMapImports, rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { writePipelineLayers } from "~/server/modules/maps/map-import.pipeline";
import { canImportRealmMap } from "~/server/modules/realms/realms.access";
import { findImportRealm } from "~/server/modules/maps/map-import.realm";
import { polygonalAreaSqKm } from "~/lib/maps/planet";
import { mapImportApplySchema, type EngineResult } from "~/lib/maps/import/options";
import { admin, fakeDb, founder, stranger } from "./map-import-fakes";

const square = (x: number, size = 10): Polygon => ({
  type: "Polygon",
  coordinates: [[[x, 0], [x + size, 0], [x + size, size], [x, size], [x, 0]]],
});

const result: EngineResult = {
  kind: "geojson",
  space: "lonlat",
  width: 360,
  height: 180,
  regions: [
    { key: "A", name: "Aurelia" },
    { key: "B", name: "Borealis" },
    { key: "C", name: "Cyrene" },
    { key: "SEA", name: "Sea", water: true },
  ],
  features: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { key: "A" }, geometry: square(0) },
      { type: "Feature", properties: { key: "B" }, geometry: square(10) },
      { type: "Feature", properties: { key: "C" }, geometry: square(30) },
      { type: "Feature", properties: { key: "SEA" }, geometry: square(60) },
    ],
  },
  report: { log: [], warnings: [], timingsMs: {} },
};

function setup(radiusKm?: number) {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: "founder_1",
    settings: radiusKm ? { map: { radiusKm } } : {},
  });
  db.country.rows.push(
    { id: "c_aur", name: "Aurelia", realmId: "r1", landArea: null, geometry: null },
    { id: "c_bor", name: "Borealis", realmId: "r1", landArea: 51_000, geometry: null }
  );
  // Borealis already has a border (unchanged below); Old Kingdom is stale; a lake on another layer.
  db.mapLayer.rows.push(
    { id: "m1", realmId: "r1", layerType: "political", featureId: "borealis-key", displayName: "Borealis", countryId: "c_bor", geometry: square(10), properties: {}, isActive: true },
    { id: "m2", realmId: "r1", layerType: "political", featureId: "Old Kingdom", displayName: "Old Kingdom", countryId: null, geometry: square(90), properties: {}, isActive: true },
    { id: "m3", realmId: "r1", layerType: "lakes", featureId: "lake-1", displayName: "Lake", countryId: null, geometry: square(100, 1), properties: {}, isActive: true }
  );
  return db;
}

const apply = (mode: "merge" | "replace", extra: Record<string, string | null> = {}) =>
  mapImportApplySchema.parse({ mapping: { A: "aurelia", B: "Borealis", C: "Cyrine", ...extra }, mode });

describe("planMapImport (the dry run)", () => {
  it("lists new, changed and unchanged borders, matched names, unknown names and unmatched regions", async () => {
    const db = setup();
    const realm = await findImportRealm(db, "r1");
    const plan = await planMapImport(db as never, realm, result, apply("merge"), {});
    const byNation = Object.fromEntries(plan.diff.features.map((f) => [f.nation, f]));
    expect(byNation.Aurelia).toMatchObject({ key: "Aurelia", countryId: "c_aur", status: "new" });
    // Borealis keeps its existing feature key and stated land area; its border is the same as before.
    expect(byNation.Borealis).toMatchObject({ key: "borealis-key", status: "unchanged", landArea: { current: 51_000, action: "keep" } });
    expect(byNation.Aurelia!.landArea).toEqual({ current: null, action: "fill" });
    expect(byNation.Cyrine).toMatchObject({ countryId: null, landArea: { action: "none" } });
    expect(plan.diff.newNames).toEqual([{ nation: "Cyrine", suggestions: [] }]);
    expect(plan.diff.unmatched).toEqual([]); // the sea is water, not unmatched
    expect(plan.diff.kept).toBe(1);
    expect(plan.diff.removed).toEqual([]);
  });

  it("replace mode lists the political features the new map does not have", async () => {
    const db = setup();
    const plan = await planMapImport(db as never, await findImportRealm(db, "r1"), result, apply("replace"), {});
    expect(plan.diff.removed).toEqual([{ key: "Old Kingdom", name: "Old Kingdom", countryName: null }]);
  });

  it("marks a border that moved as changed", async () => {
    const db = setup();
    db.mapLayer.rows[0].geometry = square(11);
    const plan = await planMapImport(db as never, await findImportRealm(db, "r1"), result, apply("merge"), {});
    expect(plan.diff.features.find((f) => f.nation === "Borealis")?.status).toBe("changed");
  });

  it("reports a region left unmapped", async () => {
    const db = setup();
    const plan = await planMapImport(db as never, await findImportRealm(db, "r1"), result, apply("merge", { C: null }), {});
    expect(plan.diff.unmatched).toEqual([{ key: "C", name: "Cyrene", colour: undefined, pixels: undefined }]);
  });

  it("measures areas on the realm's own planet", async () => {
    const earth = setup();
    const small = setup(6371 / 2);
    const area = async (db: ReturnType<typeof setup>) =>
      (await planMapImport(db as never, await findImportRealm(db, "r1"), result, apply("merge"), {})).diff.features[0]!
        .areaKm2!;
    expect(await area(earth)).toBeCloseTo(polygonalAreaSqKm(square(0)), 3);
    expect((await area(small)) / (await area(earth))).toBeCloseTo(0.25, 6);
  });
});

describe("applyMapImportPlan and rollback", () => {
  it("replace mode retires stale political features only, then rolls back exactly", async () => {
    const db = setup();
    const realm = await findImportRealm(db, "r1");
    const plan = await planMapImport(db as never, realm, result, apply("replace"), {});
    const applied = await applyMapImportPlan(db as never, realm, plan, { jobId: "j1", requestedBy: "admin_1" });
    expect(applied).toMatchObject({ written: 3, deactivated: 1, landAreasFilled: ["Aurelia"], rollbackAvailable: true });
    const row = (key: string) => db.mapLayer.rows.find((r: { featureId: string }) => r.featureId === key);
    expect(row("Old Kingdom").isActive).toBe(false);
    expect(row("lake-1").isActive).toBe(true); // another layer is never touched
    expect(row("borealis-key").geometry).toEqual(plan.features.find((f) => f.key === "borealis-key")!.geometry);
    expect(db.country.rows[0].landArea).toBeGreaterThan(0);
    expect(db.country.rows[1].landArea).toBe(51_000); // a stated land area is kept

    const history = await listMapImports(db as never, admin, "r1");
    expect(history[0]).toMatchObject({ id: applied.mapImportId, canRollBack: true });

    const restored = await rollbackMapImport(db as never, admin, applied.mapImportId);
    expect(restored).toMatchObject({ deleted: 2 }); // Aurelia and Cyrine did not exist before
    expect(row("Aurelia")).toBeUndefined();
    expect(row("Old Kingdom").isActive).toBe(true);
    expect(row("borealis-key").geometry).toEqual(square(10));
    expect(db.country.rows[0].landArea).toBeNull();
    await expect(rollbackMapImport(db as never, admin, applied.mapImportId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("only the latest import still in place can be rolled back, and only by its staff", async () => {
    const db = setup();
    const realm = await findImportRealm(db, "r1");
    const first = await applyMapImportPlan(
      db as never,
      realm,
      await planMapImport(db as never, realm, result, apply("merge"), {}),
      { jobId: "j1", requestedBy: "admin_1" }
    );
    const second = await applyMapImportPlan(
      db as never,
      realm,
      await planMapImport(db as never, realm, result, apply("merge"), {}),
      { jobId: "j2", requestedBy: "admin_1" }
    );
    await expect(rollbackMapImport(db as never, admin, first.mapImportId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(rollbackMapImport(db as never, stranger, second.mapImportId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rollbackMapImport(db as never, founder, second.mapImportId)).resolves.toMatchObject({ restored: 3 });
  });
});

describe("importPipelineResult on the shared writer", () => {
  it("replace mode retires stale features of the imported layer types only, with names and a snapshot", async () => {
    const db = setup();
    const out = await writePipelineLayers(db as never, {
      realmId: "r1",
      mode: "replace",
      createdBy: "admin_1",
      layers: {
        lakes: {
          type: "FeatureCollection",
          features: [{ type: "Feature", id: "lake-2", properties: { name: "Blue Lake" }, geometry: square(120, 1) }],
        },
      },
    });
    expect(out).toMatchObject({ imported: 1, deactivated: 1, mode: "replace" });
    const row = (key: string) => db.mapLayer.rows.find((r: { featureId: string }) => r.featureId === key);
    expect(row("lake-2")).toMatchObject({ displayName: "Blue Lake", isActive: true });
    expect(row("lake-1").isActive).toBe(false);
    expect(row("Old Kingdom").isActive).toBe(true); // political untouched
    expect(db.mapImport.rows[0]).toMatchObject({ layerTypes: ["lakes"], mode: "replace", rollbackAvailable: true });
  });

  it("rejects bad geometry instead of writing it, and accepts river lines", async () => {
    const db = setup();
    const out = await writePipelineLayers(db as never, {
      realmId: "r1",
      mode: "merge",
      createdBy: "admin_1",
      layers: {
        rivers: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", id: "r-1", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } },
            { type: "Feature", id: "r-2", properties: {}, geometry: { type: "LineString", coordinates: [[0, 0], [500, 1]] } },
          ],
        },
      },
    });
    expect(out.imported).toBe(1);
    expect(out.rejected).toEqual([{ layerType: "rivers", key: "r-2", reason: expect.stringMatching(/lon\/lat/) }]);
  });
});

describe("canImportRealmMap (who reaches the import)", () => {
  it("allows site admins, the founder and officers with the Map power; IxWorld is admin-only", () => {
    const realm = { id: "r1", ownerId: "founder_1" };
    expect(canImportRealmMap(admin, realm, [])).toBe(true);
    expect(canImportRealmMap(founder, realm, [])).toBe(true);
    expect(canImportRealmMap(stranger, realm, [])).toBe(false);
    expect(canImportRealmMap(stranger, realm, [{ userId: "someone", powers: ["board", "claims"] }])).toBe(false);
    expect(canImportRealmMap(stranger, realm, [{ userId: "someone", powers: ["map"] }])).toBe(true);
    expect(canImportRealmMap(founder, { id: "default", ownerId: "founder_1" }, [])).toBe(false);
    expect(canImportRealmMap(null, realm, [])).toBe(false);
  });

  it("refuses an archived realm's map", async () => {
    const db = setup();
    db.realm.rows[0].status = "archived";
    await expect(listMapImports(db as never, admin, "r1")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
