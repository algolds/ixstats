/**
 * @jest-environment node
 *
 * A realm's stored map measured for World Studio's Calibration tab: read from the `geometry` JSON (a polygon across
 * the antimeridian measures as itself), Koppen and Trewartha realms alike, cached per map version, and a reason
 * instead of a throw when there is nothing to measure.
 */
import type { Geometry, Position } from "geojson";
import { measureRealm } from "~/server/modules/maps/realm-calibration";
import { fakeDb } from "./map-import-fakes";

const box = (west: number, south: number, east: number, north: number): Position[] => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const polygon = (...rings: Position[][]): Geometry => ({ type: "Polygon", coordinates: rings });

let seq = 0;
function seed(
  layers: {
    layerType: string;
    geometry: Geometry | null;
    properties?: object;
    isActive?: boolean;
  }[],
  settings: object | null = null
) {
  const db = fakeDb();
  const id = `realm_${++seq}`;
  db.realm.rows.push({ id, slug: `slug-${seq}`, name: `Realm ${seq}`, mapVersion: 7, settings });
  layers.forEach((layer, i) =>
    db.mapLayer.rows.push({
      realmId: id,
      featureId: `f${i}`,
      properties: {},
      isActive: true,
      ...layer,
    })
  );
  return { db, id, slug: `slug-${seq}` };
}

describe("measureRealm", () => {
  it("measures a realm by id or by slug", async () => {
    const { db, id, slug } = seed([
      { layerType: "political", geometry: polygon(box(0, 0, 10, 10)) },
      { layerType: "political", geometry: polygon(box(20, 0, 30, 10)) },
    ]);
    const byId = await measureRealm(db, id);
    const bySlug = await measureRealm(db, slug);
    if (!byId.ok || !bySlug.ok) throw new Error("expected a measurement");
    expect(byId.mapVersion).toBe(7);
    expect(byId.measures.nations.count).toBe(2);
    expect(bySlug.measures).toEqual(byId.measures);
  });

  it("reads an antimeridian-crossing polygon from its geometry JSON as the strip it is", async () => {
    const { db, id } = seed([
      {
        layerType: "political",
        geometry: polygon([
          [170, -5],
          [-170, -5],
          [-170, 5],
          [170, 5],
          [170, -5],
        ]),
      },
    ]);
    const result = await measureRealm(db, id);
    if (!result.ok) throw new Error("expected a measurement");
    // 20 x 10 degrees at the equator: about 0.48% of the globe and 2.5 million km2
    expect(result.measures.landShare).toBeCloseTo(0.00484, 3);
    expect(result.measures.nations.medianKm2).toBeGreaterThan(2.4e6);
    expect(result.measures.nations.medianKm2).toBeLessThan(2.55e6);
  });

  it("reads more rows than the database guard's default cap and leaves out inactive features", async () => {
    const features = Array.from({ length: 1500 }, (_, i) => ({
      layerType: "political",
      geometry: polygon(
        box(
          -60 + (i % 100),
          -20 + Math.floor(i / 100),
          -59.5 + (i % 100),
          -19.5 + Math.floor(i / 100)
        )
      ),
    }));
    const { db, id } = seed([
      ...features,
      { layerType: "political", geometry: polygon(box(100, 0, 110, 10)), isActive: false },
    ]);
    const result = await measureRealm(db, id);
    if (!result.ok) throw new Error("expected a measurement");
    expect(result.measures.nations.count).toBe(1500);
    expect(db.mapLayer.findMany.mock.calls[0][0].take).toBeGreaterThan(1000);
  });

  it("applies the realm's climate key and planet radius", async () => {
    const settings = {
      map: {
        radiusKm: 6371 / 2,
        climateKey: {
          system: "Koppen",
          zones: [{ code: "Cfb", name: "Oceanic", color: "#00ff00" }],
        },
      },
    };
    const layers = [
      { layerType: "political", geometry: polygon(box(0, 0, 40, 40)) },
      {
        layerType: "climate",
        geometry: polygon(box(0, 0, 40, 40)),
        properties: { climateId: "Cfb" },
      },
    ];
    const small = seed(layers, settings);
    const normal = seed(layers);
    const half = await measureRealm(small.db, small.id);
    const earth = await measureRealm(normal.db, normal.id);
    if (!half.ok || !earth.ok) throw new Error("expected a measurement");
    expect(half.measures.climate.D).toBeCloseTo(1, 6);
    expect(earth.measures.climate.D).toBeCloseTo(1, 6);
    expect(half.measures.nations.medianKm2).toBeCloseTo(earth.measures.nations.medianKm2 / 4, -2);
  });

  it("serves a second read of the same map version from the cache and measures again after a bump", async () => {
    const { db, id } = seed([{ layerType: "political", geometry: polygon(box(0, 0, 10, 10)) }]);
    const first = await measureRealm(db, id);
    const second = await measureRealm(db, id);
    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    db.realm.rows[0].mapVersion = 8;
    db.mapLayer.rows.push({
      realmId: id,
      featureId: "extra",
      layerType: "political",
      geometry: polygon(box(40, 0, 50, 10)),
      properties: {},
      isActive: true,
    });
    const third = await measureRealm(db, id);
    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(2);
    if (!third.ok) throw new Error("expected a measurement");
    expect(third.mapVersion).toBe(8);
    expect(third.measures.nations.count).toBe(2);
  });

  it("shares one read between concurrent requests for the same version", async () => {
    const { db, id } = seed([{ layerType: "political", geometry: polygon(box(0, 0, 10, 10)) }]);
    await Promise.all([measureRealm(db, id), measureRealm(db, id)]);
    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(1);
  });

  it("gives a reason, not a throw, for a realm with no layers or no such realm", async () => {
    const { db, id } = seed([]);
    const empty = await measureRealm(db, id);
    expect(empty).toEqual({ ok: false, reason: expect.stringMatching(/no map layers/i) });
    const missing = await measureRealm(db, "no-such-realm");
    expect(missing).toEqual({ ok: false, reason: expect.stringMatching(/no realm/i) });
    // the failure is not cached: layers added later are measured
    db.mapLayer.rows.push({
      realmId: id,
      featureId: "late",
      layerType: "political",
      geometry: polygon(box(0, 0, 10, 10)),
      properties: {},
      isActive: true,
    });
    expect((await measureRealm(db, id)).ok).toBe(true);
  });
});
